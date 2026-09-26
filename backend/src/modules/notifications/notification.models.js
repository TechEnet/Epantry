import crypto from 'crypto'

import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

export const NOTIFICATION_CHANNELS = Object.freeze([
  'in_app',
  'email',
  'sms',
  'whatsapp',
])

export const NOTIFICATION_CATEGORIES = Object.freeze([
  'planning',
  'pantry',
  'household',
  'order',
  'price',
  'class',
  'security',
  'marketing',
  'operations',
])

export const NOTIFICATION_TRIGGER_TYPES = Object.freeze([
  'planned_meal_shortage',
  'likely_low_item',
  'use_soon_ingredient',
  'pantry_setup_reminder',
  'shared_list_update',
  'household_invitation_received',
  'household_invitation_accepted',
  'household_invitation_declined',
  'repeat_meal_gap',
  'after_opening_window',
  'meaningful_price_deviation',
  'class_reminder',
  'order_milestone',
  'security_notice',
  'host_commercial_profile_request',
  'host_registration',
  'host_listing_created',
  'host_listing_updated',
  'host_inventory_low',
])

export const NOTIFICATION_ACTIONS = Object.freeze([
  'accept',
  'dismiss',
  'snooze',
  'still_have',
  'bought_elsewhere',
  'stop_suggesting',
])

export const NOTIFICATION_STATUSES = Object.freeze([
  'pending',
  'delivered',
  'read',
  'dismissed',
  'snoozed',
  'action_required_domain',
  'suppressed',
  'cancelled',
])

const notificationPreferenceSchema = new Schema(
  {
    userId: {
      type: objectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    inAppEnabled: {
      type: Boolean,
      default: true,
    },

    emailEnabled: {
      type: Boolean,
      default: true,
    },

    smsEnabled: {
      type: Boolean,
      default: false,
    },

    whatsappEnabled: {
      type: Boolean,
      default: false,
    },

    planningEnabled: {
      type: Boolean,
      default: true,
    },

    pantryEnabled: {
      type: Boolean,
      default: true,
    },

    householdEnabled: {
      type: Boolean,
      default: true,
    },

    orderEnabled: {
      type: Boolean,
      default: true,
    },

    priceEnabled: {
      type: Boolean,
      default: false,
    },

    classEnabled: {
      type: Boolean,
      default: true,
    },

    securityEnabled: {
      type: Boolean,
      default: true,
    },

    marketingEnabled: {
      type: Boolean,
      default: false,
    },

    operationsEnabled: {
      type: Boolean,
      default: true,
    },

    disabledReasonCodes: {
      type: [String],
      default: [],
    },

    quietHours: {
      enabled: {
        type: Boolean,
        default: false,
      },

      startLocalHour: {
        type: Number,
        min: 0,
        max: 23,
        default: 22,
      },

      endLocalHour: {
        type: Number,
        min: 0,
        max: 23,
        default: 7,
      },

      timezone: {
        type: String,
        trim: true,
        maxlength: 80,
        default: 'Asia/Kolkata',
      },
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'notificationPreferences',
  },
)

const notificationSchema = new Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `notif_${crypto.randomUUID()}`,
      immutable: true,
    },

    userId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },

    householdId: {
      type: objectId,
      ref: 'Household',
      default: null,
      index: true,
      immutable: true,
    },

    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      required: true,
      index: true,
      immutable: true,
    },

    triggerType: {
      type: String,
      enum: NOTIFICATION_TRIGGER_TYPES,
      required: true,
      index: true,
      immutable: true,
    },

    reasonCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
      immutable: true,
    },

    explanation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 800,
      immutable: true,
    },

    relatedEntityType: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
      immutable: true,
    },

    relatedEntityId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
      immutable: true,
    },

    sourceDomain: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },

    sourceVersion: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
      immutable: true,
    },

    actions: {
      type: [String],
      enum: NOTIFICATION_ACTIONS,
      default: [],
      immutable: true,
    },

    eligibleChannels: {
      type: [String],
      enum: NOTIFICATION_CHANNELS,
      default: ['in_app'],
      immutable: true,
    },

    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      required: true,
      default: 'pending',
      index: true,
    },

    suppressionReason: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },

    dedupeKey: {
      type: String,
      trim: true,
      maxlength: 220,
      default: null,
      immutable: true,
    },

    deliveryProvider: {
      type: String,
      enum: [
        'internal',
        'brevo',
      ],
      default: 'internal',
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    readAt: {
      type: Date,
      default: null,
    },

    snoozedUntil: {
      type: Date,
      default: null,
      index: true,
    },

    lastActionAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'notifications',
  },
)

notificationSchema.index(
  {
    userId: 1,
    dedupeKey: 1,
  },
  {
    unique: true,
    sparse: true,
  },
)

notificationSchema.index({
  userId: 1,
  createdAt: -1,
})

const notificationActionSchema = new Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `na_${crypto.randomUUID()}`,
      immutable: true,
    },

    notificationId: {
      type: objectId,
      ref: 'Notification',
      required: true,
      index: true,
      immutable: true,
    },

    userId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },

    action: {
      type: String,
      enum: NOTIFICATION_ACTIONS,
      required: true,
      index: true,
      immutable: true,
    },

    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    snoozeUntil: {
      type: Date,
      default: null,
      immutable: true,
    },

    relatedEntityType: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
      immutable: true,
    },

    relatedEntityId: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
      immutable: true,
    },

    domainDelegation: {
      type: Schema.Types.Mixed,
      default: null,
      immutable: true,
    },
  },
  {
    ...baseOptions,
    collection: 'notificationActions',
  },
)

export const NotificationPreference =
  mongoose.models.NotificationPreference ||
  mongoose.model(
    'NotificationPreference',
    notificationPreferenceSchema,
  )

export const Notification =
  mongoose.models.Notification ||
  mongoose.model(
    'Notification',
    notificationSchema,
  )

export const NotificationAction =
  mongoose.models.NotificationAction ||
  mongoose.model(
    'NotificationAction',
    notificationActionSchema,
  )