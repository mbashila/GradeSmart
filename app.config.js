require('dotenv').config();

module.exports = ({ config }) => {
  const extra = config.extra || {};
  return {
    ...config,
    extra: {
      ...extra,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || extra.EXPO_PUBLIC_SUPABASE_URL || '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || extra.EXPO_PUBLIC_OPENAI_API_KEY || '',
      EXPO_PUBLIC_GRADING_SERVER_URL: process.env.EXPO_PUBLIC_GRADING_SERVER_URL || extra.EXPO_PUBLIC_GRADING_SERVER_URL || '',
    },
  };
};
