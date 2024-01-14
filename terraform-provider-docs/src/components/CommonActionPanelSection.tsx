import { ActionPanel, Action, Icon } from "@raycast/api";

export const CommonActionPanelSection = ({ reload }: { reload: () => void }) => {
  return (
    <ActionPanel.Section title="Documents">
      <Action title="Reload Latest Providers" icon={Icon.Repeat} onAction={reload} />
    </ActionPanel.Section>
  );
};
