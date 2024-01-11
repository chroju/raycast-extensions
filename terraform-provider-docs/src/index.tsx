import { useEffect, useState } from "react";
import { ActionPanel, Icon, Action, Color, List, Cache, Image, showToast, Toast } from "@raycast/api";
import { TerraformElement, TerraformElementType, getTerraformDocURL } from "./helpers/terraform";
import { fetchTerraformElements } from "./api/github";
import { DocDetail } from "./components/DocDetail";

const cache = new Cache();
const cacheKey = "chroju-terraform-docs-cache";
const cacheTTL = 1000 * 60 * 60 * 24; // 1 day

interface cacheStructure {
  data: TerraformElement[];
  providers: string;
  expiresAt?: number;
}

const icons: { [key in TerraformElementType]: Image.ImageLike } = {
  [TerraformElementType.Resource]: { source: Icon.Box, tintColor: Color.Purple },
  [TerraformElementType.DataSource]: { source: Icon.Box, tintColor: Color.Orange },
};

export default function Command() {
  const [items, setItems] = useState<TerraformElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const providerNames = "hashicorp/aws,DataDog/datadog";

  const cachedData = cache.get(cacheKey);
  const cachedProviders = providerNames;

  const fetchData = async (providerNames: string[]) => {
    const data = await fetchTerraformElements(providerNames);
    setItems(data);
    if (data.length > 0) {
      cache.set(
        cacheKey,
        JSON.stringify({
          data: data,
          providers: cachedProviders,
          expiresAt: Date.now() + cacheTTL,
        } as cacheStructure),
      );
    }
  };

  const reload = (providerNames: string[]) => {
    fetchData(providerNames);
    showToast({ style: Toast.Style.Success, title: "Reloaded", message: "Successfully reloaded" });
  };

  useEffect(() => {
    if (
      cachedData &&
      JSON.parse(cachedData).providers === cachedProviders &&
      JSON.parse(cachedData).expiresAt > Date.now()
    ) {
      console.log("cache hit");
      setItems((JSON.parse(cachedData) as cacheStructure).data);
      setIsLoading(false);
    } else {
      fetchData(providerNames.split(","));
      setIsLoading(false);
    }
  }, []);

  return (
    <List isLoading={isLoading}>
      {items.length > 0 ? (
        items.map((item) => (
          <List.Item
            key={item.provider.name + "_" + item.name + "_" + item.type}
            icon={icons[item.type]}
            title={item.provider.name + "_" + item.name}
            subtitle={item.type}
            accessories={[
              { tag: { value: `${item.provider.version}` } },
              { text: `${item.provider.owner}/${item.provider.name}` },
            ]}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.Push title="Show Document" icon={Icon.Document} target={<DocDetail element={item} />} />
                  <Action.OpenInBrowser title="Open in Browser" url={`${getTerraformDocURL(item)}`} />
                  <Action.CopyToClipboard
                    title={`Copy ${item.type} Name`}
                    content={`${item.provider.name}_${item.name}`}
                    icon={Icon.Clipboard}
                  />
                  <Action title="Reload" icon={Icon.Repeat} onAction={() => reload(providerNames.split(","))} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.EmptyView
          actions={
            <ActionPanel>
              <Action title="Reload" icon={Icon.Repeat} onAction={() => reload(providerNames.split(","))} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
