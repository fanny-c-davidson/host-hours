import { z } from 'zod';

export const CreatePropertySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  address: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex code (e.g. #6366f1)')
    .default('#6366f1'),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geo_radius_meters: z.coerce.number().int().min(50).max(5000).default(100),
}).refine(
  (d) => (d.latitude === undefined) === (d.longitude === undefined),
  { message: 'Latitude and longitude must both be set or both be absent', path: ['latitude'] }
);

export const UpdatePropertySchema = CreatePropertySchema.partial();

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
