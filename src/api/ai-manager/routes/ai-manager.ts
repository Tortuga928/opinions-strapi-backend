export default {
  routes: [
    {
      method: 'POST',
      path: '/ai-manager/prompt',
      handler: 'api::ai-manager.ai-manager.sendPrompt',
      config: {
        auth: false, // Temporarily disable auth to unblock feature - will add back properly
      }
    }
  ]
};
