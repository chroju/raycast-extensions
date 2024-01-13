import { ActionPanel, Icon, Action, Color, List, Cache, Image, showToast, Toast } from "@raycast/api";
import { TerraformElement, TerraformElementType, getTerraformDocURL } from "./helpers/terraform";
import { getTerraformElements, getTerraformProviderFromName } from "./api/github";
import { DocDetail } from "./components/DocDetail";
import { usePromise } from "@raycast/utils";
import { useEffect, useState } from "react";

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

const fetchData = async (providerNames: string[]) => {
  console.log("fetch ...");
  const providers = Promise.all(
    providerNames.map(async (p) => {
      const splitted = p.split("/");
      return getTerraformProviderFromName(splitted[0], splitted[1]).then((provider) => provider);
    }),
  ).catch((error) => {
    throw error;
  });

  const data = providers.then(async (providers) => {
    return Promise.all(
      providers.map(async (p) => {
        return getTerraformElements(p).then((elements) => elements);
      }),
    ).catch((error) => {
      throw error;
    });
  });

  return data.then((data) => {
    return data.flat();
  });
};

export default function Command() {
  const input = "hashicorp/aws,DataDog/datadog";
  const [data, setData] = useState<TerraformElement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const cachedData = cache.get(cacheKey);
    if (cachedData && JSON.parse(cachedData).providers === input && JSON.parse(cachedData).expiresAt > Date.now()) {
      console.log("cache hit");
      setData((JSON.parse(cachedData) as cacheStructure).data);
      setIsLoading(false);
    } else {
      fetchData(input.split(","))
        .then((data) => {
          setData(data);
          setIsLoading(false);
          cache.set(cacheKey, JSON.stringify({ data: data, providers: input, expiresAt: Date.now() + cacheTTL }));
        })
        .catch((error) => {
          setIsLoading(false);
          showToast({ style: Toast.Style.Failure, title: "Failed to load", message: error.message });
        });
    }
  }, [input]);

  const reload = async () => {
    const toast = await showToast(Toast.Style.Animated, "Reloading...");
    setIsLoading(true);
    fetchData(input.split(","))
      .then((data) => {
        setData(data);
        setIsLoading(false);
        toast.style = Toast.Style.Success;
        toast.title = "Successfully reloaded";
        cache.set(cacheKey, JSON.stringify({ data: data, providers: input, expiresAt: Date.now() + cacheTTL }));
      })
      .catch((error) => {
        setIsLoading(false);
        toast.style = Toast.Style.Failure;
        toast.title = "Failed to reload";
        toast.message = error.message;
      });
  };

  return (
    <List isLoading={isLoading}>
      {data && data.length > 0 ? (
        data.map((item) => (
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
                  <Action title="Reload Latest Providers" icon={Icon.Repeat} onAction={reload} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.EmptyView
          actions={
            <ActionPanel>
              <Action title="Reload Latest Providers" icon={Icon.Repeat} onAction={reload} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
