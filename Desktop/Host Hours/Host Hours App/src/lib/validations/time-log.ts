import { z } from 'zod';

const CategoryEnum = z.enum([
  'cleaning',
  'maintenance',
  'guest_communication',
  'admin',
  'inspection',
  'staging',
  'other',
]);

export const StartTimerSchema = z.object({
  property_id: z.string().uuid('Invalid property ID'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(2000).optional(),
  category: CategoryEnum.default('other'),
  is_billable: z.boolean().default(false),
});

export const CreateTimeLogSchema = StartTimerSchema.extend({
  started_at: z.string().datetime({ message: 'Invalid start time' }),
  ended_at: z.string().datetime({ message: 'Invalid end time' }),
}).refine(
  (d) => new Date(d.ended_at) > new Date(d.started_at),
  { message: 'End time must be after start time', path: ['ended_at'] }
);

export const UpdateTimeLogSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: CategoryEnum.optional(),
  is_billable: z.boolean().optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
}).refine(
  (d) => {
    if (d.started_at && d.ended_at) {
      return new Date(d.ended_at) > new Date(d.started_at);
    }
    return true;
  },
  { message: 'End time must be after start time', path: ['ended_at'] }
);

export type StartTimerInput = z.infer<typeof StartTimerSchema>;
export type CreateTimeLogInput = z.infer<typeof CreateTimeLogSchema>;
export type UpdateTimeLogInput = z.infer<typeof UpdateTimeLogSchema>;
