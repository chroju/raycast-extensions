import {
  ActionPanel,
  Icon,
  Action,
  Color,
  List,
  Cache,
  Image,
  showToast,
  Toast,
  getPreferenceValues,
} from "@raycast/api";
import { TerraformElement, TerraformElementType, getTerraformDocURL } from "./helpers/terraform";
import { getTerraformElements, getTerraformProviderFromName } from "./api/github";
import { DocDetail } from "./components/DocDetail";
import { CommonActionPanelSection } from "./components/CommonActionPanelSection";
import { useEffect, useState } from "react";
import { AddRecentView, GetRecentViews } from "./helpers/recentViews";

const cache = new Cache();
const cacheKey = "chroju-terraform-docs-cache";
const cacheTTL = 1000 * 60 * 60 * 24; // 1 day

interface Preferences {
  providers: string;
}

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
  if (providerNames.length === 0 || providerNames[0] === "") {
    return [];
  }
  console.log("fetch ...");
  const providers = Promise.all(
    providerNames.map(async (p) => {
      const splitted = p.split("/");
      return getTerraformProviderFromName(splitted[0], splitted[1])
        .then((provider) => provider)
        .catch((error) => {
          throw new Error(`${p}: ${error}`);
        });
    }),
  ).catch((error) => {
    throw error;
  });

  const data = providers.then(async (providers) => {
    return Promise.all(
      providers.map(async (p) => {
        return getTerraformElements(p)
          .then((elements) => elements)
          .catch((error) => {
            throw new Error(`${p.owner}/${p.name}: ${error}`);
          });
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
  const input = getPreferenceValues<Preferences>().providers;
  const [data, setData] = useState<TerraformElement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const cachedData = cache.get(cacheKey);
    if (input === "") {
      setIsLoading(false);
    } else if (
      cachedData &&
      JSON.parse(cachedData).providers === input &&
      JSON.parse(cachedData).expiresAt > Date.now()
    ) {
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

  const recentViews = GetRecentViews();

  return (
    <List isLoading={isLoading}>
      {data && data.length > 0 ? (
        <>
          {recentViews && recentViews.length > 0 && (
            <SearchListItems items={recentViews} listTitle="Recent Viewed" reload={reload} />
          )}
          <SearchListItems items={data} listTitle="All" reload={reload} />
        </>
      ) : (
        <List.EmptyView
          title="No Documents Found"
          description="Please check your provider settings or try again later."
          icon={Icon.XMarkTopRightSquare}
          actions={
            <ActionPanel>
              <CommonActionPanelSection reload={reload} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

function SearchActionPanel(props: { item: TerraformElement; reload: () => void }) {
  const item = props.item;
  return (
    <ActionPanel title={`${item.provider.name}_${item.name}`}>
      <ActionPanel.Section>
        <Action.Push title="Show Document" icon={Icon.Document} target={<DocDetail element={item} />} />
        <Action.OpenInBrowser
          title="Open in Browser"
          url={`${getTerraformDocURL(item)}`}
          onOpen={() => AddRecentView(item)}
        />
        <Action.CopyToClipboard
          title={`Copy ${item.type} Name`}
          content={`${item.provider.name}_${item.name}`}
          icon={Icon.Clipboard}
        />
        <Action.CopyToClipboard
          title={`Copy Document URL`}
          content={`${getTerraformDocURL(item)}`}
          icon={Icon.Clipboard}
        />
      </ActionPanel.Section>
      <CommonActionPanelSection reload={props.reload} />
    </ActionPanel>
  );
}

function SearchListItems(props: { items: TerraformElement[]; listTitle: string; reload: () => void }) {
  const items = props.items;
  return (
    <List.Section title={props.listTitle}>
      {items.map((item) => (
        <List.Item
          key={`${item.provider.name}_${item.name}_${item.type}`}
          title={`${item.provider.name}_${item.name}`}
          icon={icons[item.type]}
          subtitle={item.type}
          keywords={[`${item.provider.name}_${item.name}`, item.type]}
          accessories={[
            { tag: { value: `${item.provider.version}` } },
            { text: `${item.provider.owner}/${item.provider.name}` },
          ]}
          actions={<SearchActionPanel item={item} reload={props.reload} />}
        />
      ))}
    </List.Section>
  );
}
