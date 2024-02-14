import { ActionPanel, Action, Icon, openExtensionPreferences } from "@raycast/api";

export const CommonActionPanelSection = ({ reload }: { reload: () => void }) => {
  return (
    <ActionPanel.Section title="Documents">
      <Action title="Reload Latest Providers" icon={Icon.Repeat} onAction={reload} />
      <Action title="Edit Providers" icon={Icon.Cog} onAction={openExtensionPreferences} />
    </ActionPanel.Section>
  );
};
