import { object, string } from 'yup';

export const registerSchema = object({
    firstName: string().required('First name required.'),
    lastName: string().required('Last name required.'),
    email: string().email().required('Email is required.'),
    password: string().required('Password is required.').min(8, 'Password is too short - should be 8 chars minimum.'),
    dateOfBirth: string().required('Date of Birth is required.'),
    countryCode: string(),
    phone: string().required('Contact Number is required.'),
    emergencyName: string(),
    emergencyContact: string(),
    city: string()
});

export const loginSchema = object({
    email: string().email().required('Email is required.'),
    password: string().required('Password is required.'),
});

export const resetPasswordSchema = object({
    password: string().min(8).max(32).required('Password is required'),
});

export const changePasswordSchema = object({
    oldPassword: string().required('Old password is required'),
    password: string().min(8).max(32).required('Password is required'),
});

export const resendVerifySchema = object({
    email: string().email().required('Email is required.'),
});

export const verifyCodeSchema = object({
    email: string().required('Email is required.').email('Please enter valid email'),
    userId: string().required('User id is required.'),
    code: string().required('Code is required.'),
    codeHash: string().required('Code hash is required.'),
});

export const verifyUserRegisterationSchema = object({
    code: string().required('Email is required'),
});

export const socialRegisterSchema = object({
    firstName: string().required('First Name is required'),
    lastName: string().required('Last Name is required'),
    registerMethod: string()?.required('Please tell me about the registration method.'),
    profileImage: string(),
});

export const updateUserSchema = object({
    firstName: string().required('First name required.'),
    lastName: string().required('Last name required.'),
    dateOfBirth: string().required('Date of Birth is required.'),
    countryCode: string(),
    emergencyName: string(),
    emergencyContact: string(),
    city: string()
});

