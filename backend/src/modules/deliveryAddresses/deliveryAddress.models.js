import mongoose from 'mongoose'

const {
  Schema,
  model,
  models,
} = mongoose

export const DELIVERY_ADDRESS_RECIPIENT_TYPES =
  Object.freeze([
    'self',
    'other',
  ])

export const DELIVERY_ADDRESS_LABELS =
  Object.freeze([
    'home',
    'office',
    'family',
    'friend',
    'other',
  ])

export const DELIVERY_ADDRESS_SOURCES =
  Object.freeze([
    'manual',
    'current_location',
  ])

const deliveryAddressSchema =
  new Schema(
    {
      userId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      recipientType: {
        type:
          String,

        enum:
          DELIVERY_ADDRESS_RECIPIENT_TYPES,

        required:
          true,

        default:
          'self',
      },

      recipientName: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          80,
      },

      phone: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          18,
      },

      label: {
        type:
          String,

        enum:
          DELIVERY_ADDRESS_LABELS,

        required:
          true,

        default:
          'home',
      },

      customLabel: {
        type:
          String,

        trim:
          true,

        maxlength:
          40,

        default:
          '',
      },

      addressLine1: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          160,
      },

      addressLine2: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          '',
      },

      area: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          120,
      },

      landmark: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        default:
          '',
      },

      city: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          100,
      },

      state: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          100,
      },

      postalCode: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          12,

        index:
          true,
      },

      country: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          100,

        default:
          'India',
      },

      deliveryInstructions: {
        type:
          String,

        trim:
          true,

        maxlength:
          240,

        default:
          '',
      },

      source: {
        type:
          String,

        enum:
          DELIVERY_ADDRESS_SOURCES,

        required:
          true,

        default:
          'manual',
      },

      isDefault: {
        type:
          Boolean,

        required:
          true,

        default:
          false,

        index:
          true,
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'archived',
        ],

        required:
          true,

        default:
          'active',

        index:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        'deliveryAddresses',

      strict:
        'throw',
    },
  )

deliveryAddressSchema.index({
  userId:
    1,

  status:
    1,

  isDefault:
    -1,

  updatedAt:
    -1,
})

export const DeliveryAddress =
  models.DeliveryAddress ||
  model(
    'DeliveryAddress',
    deliveryAddressSchema,
  )
