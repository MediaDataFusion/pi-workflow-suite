export const packageMediaVersion = '0.0.12';

export const packageMediaBaseUrl =
  `https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@${packageMediaVersion}/docs/assets`;

export function packageMediaUrl(assetPath) {
  const normalizedPath = assetPath.replace(/^docs\/assets\//, '').replace(/^\/+/, '');
  return `${packageMediaBaseUrl}/${normalizedPath}`;
}

export const packageMediaUrls = {
  header: packageMediaUrl('pi-workflow-suite-header.png'),
  demoGif: packageMediaUrl('pi-workflow-suite-demo.gif'),
  demoMp4: packageMediaUrl('pi-workflow-suite-demo.mp4'),
  readmeInstall: packageMediaUrl('readme-link-install.svg'),
  readmeQuickStart: packageMediaUrl('readme-link-quick-start.svg'),
  readmeCommands: packageMediaUrl('readme-link-commands.svg'),
  readmeSettings: packageMediaUrl('readme-link-settings.svg'),
  screenshots: {
    missionHome: packageMediaUrl('screenshots/00-mission-home.png'),
    startupLogo: packageMediaUrl('screenshots/01-startup-Logo.png'),
    themeSettings: packageMediaUrl('screenshots/02-theme-settings.png'),
    globalSafetySettings: packageMediaUrl('screenshots/03-GlobalSafetySettings.png'),
    sharedSubAgentsSettings: packageMediaUrl('screenshots/04-SharedSubAgentsSettings.png'),
    missionMode: packageMediaUrl('screenshots/05-mission-mode.png'),
    diagramMermaid: packageMediaUrl('screenshots/06-diagram-mermaid.png'),
  },
};
