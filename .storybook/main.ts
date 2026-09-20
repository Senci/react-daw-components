import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-vite',
  docs: {
    autodocs: 'tag',
  },
  viteFinal: async (config) => {
    if (process.env.GITHUB_ACTIONS) {
      config.base = '/react-daw-components/';
    }
    return config;
  },
};
export default config;
