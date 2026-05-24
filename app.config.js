require('dotenv').config();

module.exports = ({ config }) => {
  const extra = config.extra || {};
  const plugins = config.plugins || [];
  if (!plugins.includes('expo-web-browser')) plugins.push('expo-web-browser');
  if (!plugins.includes('expo-font')) plugins.push('expo-font');
  return {
    ...config,
    plugins,
    extra: {
      ...extra,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || extra.EXPO_PUBLIC_SUPABASE_URL || '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      EXPO_PUBLIC_OPENROUTER_API_KEY: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || extra.EXPO_PUBLIC_OPENROUTER_API_KEY || '',
      EXPO_PUBLIC_GRADING_SERVER_URL: process.env.EXPO_PUBLIC_GRADING_SERVER_URL || extra.EXPO_PUBLIC_GRADING_SERVER_URL || '',
    },
  };
};
