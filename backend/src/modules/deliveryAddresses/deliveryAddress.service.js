import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  DeliveryAddress,
} from './deliveryAddress.models.js'

const MAX_ACTIVE_ADDRESSES =
  12

function normalizePhone(
  value,
) {
  const raw =
    String(
      value ||
        '',
    ).trim()

  if (
    raw.startsWith(
      '+',
    )
  ) {
    return `+${raw
      .slice(1)
      .replace(
        /\D/g,
        '',
      )}`
  }

  return raw.replace(
    /\D/g,
    '',
  )
}

function requireCustomerUser(
  currentUser,
) {
  const userId =
    currentUser?._id ||
    currentUser?.id

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(
      userId,
    )
  ) {
    throw new ApiError(
      401,
      'Authenticated Customer identity is required.',
    )
  }

  return userId
}

export function serializeDeliveryAddress(
  address,
) {
  if (!address) {
    return null
  }

  return {
    id:
      String(
        address._id,
      ),

    recipientType:
      address.recipientType,

    recipientName:
      address.recipientName,

    phone:
      address.phone,

    label:
      address.label,

    customLabel:
      address.customLabel ||
      '',

    addressLine1:
      address.addressLine1,

    addressLine2:
      address.addressLine2 ||
      '',

    area:
      address.area,

    landmark:
      address.landmark ||
      '',

    city:
      address.city,

    state:
      address.state,

    postalCode:
      address.postalCode,

    country:
      address.country,

    deliveryInstructions:
      address.deliveryInstructions ||
      '',

    source:
      address.source,

    isDefault:
      address.isDefault ===
      true,

    createdAt:
      address.createdAt,

    updatedAt:
      address.updatedAt,
  }
}

export async function listDeliveryAddresses(
  currentUser,
) {
  const userId =
    requireCustomerUser(
      currentUser,
    )

  const addresses =
    await DeliveryAddress.find({
      userId,
      status:
        'active',
    })
      .sort({
        isDefault:
          -1,
        updatedAt:
          -1,
      })
      .lean()

  return {
    addresses:
      addresses.map(
        serializeDeliveryAddress,
      ),
  }
}

export async function getDefaultDeliveryAddress(
  currentUser,
) {
  const userId =
    requireCustomerUser(
      currentUser,
    )

  let address =
    await DeliveryAddress.findOne({
      userId,
      status:
        'active',
      isDefault:
        true,
    })
      .sort({
        updatedAt:
          -1,
      })
      .lean()

  if (!address) {
    address =
      await DeliveryAddress.findOne({
        userId,
        status:
          'active',
      })
        .sort({
          updatedAt:
            -1,
        })
        .lean()
  }

  return {
    address:
      serializeDeliveryAddress(
        address,
      ),
  }
}

export async function createDeliveryAddress(
  input,
  currentUser,
) {
  const userId =
    requireCustomerUser(
      currentUser,
    )

  const activeCount =
    await DeliveryAddress.countDocuments({
      userId,
      status:
        'active',
    })

  if (
    activeCount >=
    MAX_ACTIVE_ADDRESSES
  ) {
    throw new ApiError(
      409,
      `You can keep up to ${MAX_ACTIVE_ADDRESSES} active delivery addresses.`,
    )
  }

  const shouldBeDefault =
    input.isDefault ===
      true ||
    activeCount ===
      0

  if (
    shouldBeDefault
  ) {
    await DeliveryAddress.updateMany(
      {
        userId,
        status:
          'active',
        isDefault:
          true,
      },
      {
        $set: {
          isDefault:
            false,
        },
      },
    )
  }

  const address =
    await DeliveryAddress.create({
      userId,

      recipientType:
        input.recipientType,

      recipientName:
        input.recipientName,

      phone:
        normalizePhone(
          input.phone,
        ),

      label:
        input.label,

      customLabel:
        input.label ===
          'other'
          ? input.customLabel
          : '',

      addressLine1:
        input.addressLine1,

      addressLine2:
        input.addressLine2,

      area:
        input.area,

      landmark:
        input.landmark,

      city:
        input.city,

      state:
        input.state,

      postalCode:
        input.postalCode,

      country:
        input.country,

      deliveryInstructions:
        input.deliveryInstructions,

      source:
        input.source,

      isDefault:
        shouldBeDefault,
    })

  return {
    address:
      serializeDeliveryAddress(
        address,
      ),
  }
}

export async function updateDeliveryAddress(
  addressId,
  input,
  currentUser,
) {
  const userId =
    requireCustomerUser(
      currentUser,
    )

  const address =
    await DeliveryAddress.findOne({
      _id:
        addressId,
      userId,
      status:
        'active',
    })

  if (!address) {
    throw new ApiError(
      404,
      'Delivery address was not found.',
    )
  }

  if (
    input.isDefault ===
      true &&
    address.isDefault !==
      true
  ) {
    await DeliveryAddress.updateMany(
      {
        userId,
        status:
          'active',
        isDefault:
          true,
        _id: {
          $ne:
            address._id,
        },
      },
      {
        $set: {
          isDefault:
            false,
        },
      },
    )
  }

  address.recipientType =
    input.recipientType
  address.recipientName =
    input.recipientName
  address.phone =
    normalizePhone(
      input.phone,
    )
  address.label =
    input.label
  address.customLabel =
    input.label ===
      'other'
      ? input.customLabel
      : ''
  address.addressLine1 =
    input.addressLine1
  address.addressLine2 =
    input.addressLine2
  address.area =
    input.area
  address.landmark =
    input.landmark
  address.city =
    input.city
  address.state =
    input.state
  address.postalCode =
    input.postalCode
  address.country =
    input.country
  address.deliveryInstructions =
    input.deliveryInstructions
  address.source =
    input.source
  address.isDefault =
    address.isDefault ===
      true ||
    input.isDefault ===
      true

  await address.save()

  return {
    address:
      serializeDeliveryAddress(
        address,
      ),
  }
}

export async function setDefaultDeliveryAddress(
  addressId,
  currentUser,
) {
  const userId =
    requireCustomerUser(
      currentUser,
    )

  const address =
    await DeliveryAddress.findOne({
      _id:
        addressId,
      userId,
      status:
        'active',
    })

  if (!address) {
    throw new ApiError(
      404,
      'Delivery address was not found.',
    )
  }

  await DeliveryAddress.updateMany(
    {
      userId,
      status:
        'active',
      isDefault:
        true,
      _id: {
        $ne:
          address._id,
      },
    },
    {
      $set: {
        isDefault:
          false,
      },
    },
  )

  address.isDefault =
    true

  await address.save()

  return {
    address:
      serializeDeliveryAddress(
        address,
      ),
  }
}
