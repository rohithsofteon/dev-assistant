export const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://rfp-assistant-backend.onrender.com';
  }
  return 'http://localhost:5000';
};

export function generatePassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}
