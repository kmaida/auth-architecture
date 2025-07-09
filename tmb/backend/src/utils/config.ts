// Environment variable validation helper
export const validateEnvironmentVariables = (requiredVars: string[]) => {
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
  
  return {
    CLIENT_ID: process.env.CLIENT_ID!,
    CLIENT_SECRET: process.env.CLIENT_SECRET!,
    FUSIONAUTH_URL: process.env.FUSIONAUTH_URL!,
    FRONTEND_URL: process.env.FRONTEND_URL!,
    BACKEND_URL: process.env.BACKEND_URL!
  };
};
