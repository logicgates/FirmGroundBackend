import { object, string, number } from 'yup';

export const chatMessageSchema = object({
    message: object(),
});
