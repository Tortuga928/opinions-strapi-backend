import path from 'path';

export default ({ env }) => ({
  email: {
    config: {
      provider: path.resolve('./src/providers/sendgrid-direct.js'),
      providerOptions: {
        apiKey: env('SENDGRID_API_KEY'),
      },
      settings: {
        defaultFrom: env('SENDGRID_DEFAULT_FROM', 'steven.banke@gmail.com'),
        defaultReplyTo: env('SENDGRID_DEFAULT_REPLY_TO', 'steven.banke@gmail.com'),
      },
    },
  },
});
