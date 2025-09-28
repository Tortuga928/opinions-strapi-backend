export default {
  routes: [
    {
      method: 'POST',
      path: '/opinions/generate',
      handler: 'opinion.generateOpinion',
      config: {
        auth: false // Make it public temporarily for testing
      },
    },
  ],
};