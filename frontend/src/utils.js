export const getBaseUrl = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  // TODO: Replace this with your actual production backend URL
  const productionUrl = 'https://your-production-backend-url.com'; 
  
  // URL for local development
  const developmentUrl = 'http://localhost:5000';

  return isProduction ? productionUrl : developmentUrl;
};

export function generatePassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}
