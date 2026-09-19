import {
  z,
} from 'zod';

import {
  COURSE_CONTENT_STATUSES,
  COURSE_LESSON_ACCESS_POLICIES,
  COURSE_LESSON_TYPES,
  COURSE_MEDIA_AVAILABILITY_STATES,
  COURSE_MEDIA_TYPES,
  LESSON_PROGRESS_STATUSES,
} from './learning.models.js';

export const learningObjectIdSchema =
  z
      .string()
      .trim()
      .regex(
          /^[a-f\d]{24}$/i,
          'A valid MongoDB ObjectId is required.',
      );

const normalizedKeySchema =
  z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'Use a lowercase kebab-case key.',
      );

const boundedText = (
  max,
) =>
  z
      .string()
      .trim()
      .max(max);

export const courseIdParamsSchema =
  z
      .object({
          courseId:
              learningObjectIdSchema,
      })
      .strict();

export const courseLessonParamsSchema =
  z
      .object({
          courseId:
              learningObjectIdSchema,

          lessonId:
              learningObjectIdSchema,
      })
      .strict();

export const courseModuleParamsSchema =
  z
      .object({
          courseId:
              learningObjectIdSchema,

          moduleId:
              learningObjectIdSchema,
      })
      .strict();

export const createCourseModuleBodySchema =
  z
      .object({
          moduleKey:
              normalizedKeySchema,

          title:
              boundedText(220)
                  .min(1),

          summary:
              boundedText(4000)
                  .optional()
                  .default(''),

          sortOrder:
              z
                  .number()
                  .int()
                  .min(0)
                  .max(10000)
                  .optional()
                  .default(0),
      })
      .strict();

export const updateCourseModuleBodySchema =
  z
      .object({
          title:
              boundedText(220)
                  .min(1)
                  .optional(),

          summary:
              boundedText(4000)
                  .optional(),

          sortOrder:
              z
                  .number()
                  .int()
                  .min(0)
                  .max(10000)
                  .optional(),

          status:
              z
                  .enum(COURSE_CONTENT_STATUSES)
                  .optional(),
      })
      .strict()
      .refine(
          (value) =>
              Object.keys(value).length > 0,
          'At least one module field must be updated.',
      );

export const createCourseLessonBodySchema =
  z
      .object({
          moduleId:
              learningObjectIdSchema,

          lessonKey:
              normalizedKeySchema,

          title:
              boundedText(220)
                  .min(1),

          summary:
              boundedText(5000)
                  .optional()
                  .default(''),

          lessonType:
              z.enum(
                  COURSE_LESSON_TYPES,
              ),

          accessPolicy:
              z
                  .enum(
                      COURSE_LESSON_ACCESS_POLICIES,
                  )
                  .optional()
                  .default('course'),

          sortOrder:
              z
                  .number()
                  .int()
                  .min(0)
                  .max(10000)
                  .optional()
                  .default(0),

          durationSeconds:
              z
                  .number()
                  .int()
                  .min(0)
                  .max(172800)
                  .optional()
                  .default(0),

          bodyText:
              z
                  .string()
                  .max(50000)
                  .optional()
                  .default(''),

          linkedRecipeVersionId:
              learningObjectIdSchema
                  .nullable()
                  .optional()
                  .default(null),

          isRequiredForCompletion:
              z
                  .boolean()
                  .optional()
                  .default(true),
      })
      .strict()
      .superRefine(
          (
              value,
              context,
          ) => {
              if (
                  value.lessonType === 'text' &&
                  !String(value.bodyText || '').trim()
              ) {
                  context.addIssue({
                      code:
                          z.ZodIssueCode.custom,

                      path: [
                          'bodyText',
                      ],

                      message:
                          'Text lessons require lesson body content.',
                  });
              }

              if (
                  value.lessonType === 'recipe' &&
                  !value.linkedRecipeVersionId
              ) {
                  context.addIssue({
                      code:
                          z.ZodIssueCode.custom,

                      path: [
                          'linkedRecipeVersionId',
                      ],

                      message:
                          'Recipe lessons require a governed Recipe Version reference.',
                  });
              }
          },
      );

export const updateCourseLessonBodySchema =
  z
      .object({
          title:
              boundedText(220)
                  .min(1)
                  .optional(),

          summary:
              boundedText(5000)
                  .optional(),

          accessPolicy:
              z
                  .enum(
                      COURSE_LESSON_ACCESS_POLICIES,
                  )
                  .optional(),

          sortOrder:
              z
                  .number()
                  .int()
                  .min(0)
                  .max(10000)
                  .optional(),

          durationSeconds:
              z
                  .number()
                  .int()
                  .min(0)
                  .max(172800)
                  .optional(),

          bodyText:
              z
                  .string()
                  .max(50000)
                  .optional(),

          linkedRecipeVersionId:
              learningObjectIdSchema
                  .nullable()
                  .optional(),

          isRequiredForCompletion:
              z
                  .boolean()
                  .optional(),

          status:
              z
                  .enum(COURSE_CONTENT_STATUSES)
                  .optional(),
      })
      .strict()
      .refine(
          (value) =>
              Object.keys(value).length > 0,
          'At least one lesson field must be updated.',
      );

export const registerCourseMediaBodySchema =
  z
      .object({
          lessonId:
              learningObjectIdSchema,

          mediaType:
              z.enum(
                  COURSE_MEDIA_TYPES,
              ),

          storageProvider:
              z
                  .string()
                  .trim()
                  .min(1)
                  .max(80)
                  .regex(
                      /^[a-z0-9_-]+$/i,
                      'Storage provider contains unsupported characters.',
                  ),

          assetReference:
              z
                  .string()
                  .trim()
                  .min(1)
                  .max(1000),

          language:
              z
                  .string()
                  .trim()
                  .toLowerCase()
                  .max(24)
                  .optional()
                  .default(''),

          label:
              boundedText(160)
                  .optional()
                  .default(''),

          mimeType:
              z
                  .string()
                  .trim()
                  .toLowerCase()
                  .max(120)
                  .optional()
                  .default(''),

          durationSeconds:
              z
                  .number()
                  .int()
                  .min(0)
                  .max(172800)
                  .optional()
                  .default(0),

          availabilityState:
              z
                  .enum(
                      COURSE_MEDIA_AVAILABILITY_STATES,
                  )
                  .optional()
                  .default('processing'),

          isDefault:
              z
                  .boolean()
                  .optional()
                  .default(false),

          downloadable:
              z
                  .boolean()
                  .optional()
                  .default(false),

          rightsStatement:
              boundedText(2000)
                  .optional()
                  .default(''),
      })
      .strict();

export const updateCourseMediaStateBodySchema =
  z
      .object({
          availabilityState:
              z.enum(
                  COURSE_MEDIA_AVAILABILITY_STATES,
              ),
      })
      .strict();

export const updateLessonProgressBodySchema =
  z
      .object({
          status:
              z
                  .enum(
                      LESSON_PROGRESS_STATUSES,
                  )
                  .optional(),

          completionPercent:
              z
                  .number()
                  .min(0)
                  .max(100)
                  .optional(),

          playbackPositionSeconds:
              z
                  .number()
                  .min(0)
                  .max(172800)
                  .optional(),

          playbackSpeed:
              z
                  .number()
                  .min(0.5)
                  .max(2)
                  .optional(),
      })
      .strict()
      .refine(
          (value) =>
              Object.keys(value).length > 0,
          'At least one progress field must be updated.',
      );

export const createLessonBookmarkBodySchema =
  z
      .object({
          positionSeconds:
              z
                  .number()
                  .min(0)
                  .max(172800)
                  .optional()
                  .default(0),

          label:
              boundedText(240)
                  .optional()
                  .default(''),
      })
      .strict();

export const upsertLessonNoteBodySchema =
  z
      .object({
          noteId:
              learningObjectIdSchema
                  .nullable()
                  .optional()
                  .default(null),

          noteText:
              z
                  .string()
                  .trim()
                  .min(1)
                  .max(8000),

          positionSeconds:
              z
                  .number()
                  .min(0)
                  .max(172800)
                  .nullable()
                  .optional()
                  .default(null),
      })
      .strict();
