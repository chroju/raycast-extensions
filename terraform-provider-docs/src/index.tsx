import fetch from "node-fetch";
import { useEffect, useState } from "react";
import { ActionPanel, Icon, Action, Color, List, Detail, Cache, Image, showToast, Toast } from "@raycast/api";
import { useFetch } from "@raycast/utils";

const cache = new Cache();
const cacheKey = "chroju-terraform-docs-cache";
const cacheTTL = 1000 * 60 * 60 * 24; // 1 day

interface cacheStructure {
  data: TFElement[];
  providers: string;
  expiresAt?: number;
}

interface GitHubLinks {
  self: string;
  git: string;
  html: string;
}

enum TFElementType {
  Resource = "Resource",
  DataSource = "Data Source",
}

const icons: { [key in TFElementType]: Image.ImageLike } = {
  [TFElementType.Resource]: { source: Icon.Box, tintColor: Color.Purple },
  [TFElementType.DataSource]: { source: Icon.Box, tintColor: Color.Orange },
};

interface GitHubFileInfo {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  _links: GitHubLinks;
}

interface GitHubTagInfo {
  name: string;
  zipball_url: string;
  tarball_url: string;
  commit: {
    sha: string;
    url: string;
  };
  node_id: string;
}

interface TFProvider {
  owner: string;
  name: string;
  version?: string;
  isOldDocsPaths: boolean;
}

interface TFElement {
  name: string;
  type: TFElementType;
  provider: TFProvider;
  rawDocUrl?: string;
}

interface TFDocsPaths {
  parentDir: string;
  resourceDir: string;
  dataSourceDir: string;
  suffix: string;
}

const tfDocsPathsSpec: { old: TFDocsPaths; new: TFDocsPaths } = {
  old: {
    parentDir: "website/docs",
    resourceDir: "r",
    dataSourceDir: "d",
    suffix: ".html.markdown",
  },
  new: {
    parentDir: "docs",
    resourceDir: "resources",
    dataSourceDir: "data-sources",
    suffix: ".md",
  },
};

export default function Command() {
  const [items, setItems] = useState<TFElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const providerNames = "hashicorp/aws,DataDog/datadog";

  const cachedData = cache.get(cacheKey);
  const cachedProviders = providerNames;

  const fetchData = async (providerNames: string[]) => {
    const data = await fetchAPIs(providerNames);
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
                  <Action.Push title="Show Document" icon={Icon.Document} target={<DetailDoc item={item} />} />
                  <Action.OpenInBrowser title="Open in Browser" url={`${generateTFDocsURL(item).docUrl}`} />
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

const generateTFGitHubURL = (item: TFProvider, type: TFElementType): string => {
  const { owner, name, isOldDocsPaths } = item;
  const pathSpec = isOldDocsPaths ? "old" : "new";
  const dir =
    type === TFElementType.Resource ? tfDocsPathsSpec[pathSpec].resourceDir : tfDocsPathsSpec[pathSpec].dataSourceDir;

  return `https://api.github.com/repos/${owner}/terraform-provider-${name}/contents/${tfDocsPathsSpec[pathSpec].parentDir}/${dir}?ref=${item.version}`;
};

const generateTFDocsURL = (item: TFElement): { rawDocUrl: string; docUrl: string } => {
  const { provider, name, type } = item;
  const pathSpec = provider.isOldDocsPaths ? "old" : "new";
  const dir =
    type === TFElementType.Resource ? tfDocsPathsSpec[pathSpec].resourceDir : tfDocsPathsSpec[pathSpec].dataSourceDir;

  // gitURL depends on the doc spec i.e old or new
  const rawDocUrl = `https://raw.githubusercontent.com/${provider.owner}/terraform-provider-${provider.name}/${provider.version}/${tfDocsPathsSpec[pathSpec].parentDir}/${dir}/${name}${tfDocsPathsSpec[pathSpec].suffix}`;

  // registryURL is constant
  const docUrl = `https://registry.terraform.io/providers/${provider.owner}/${
    provider.name
  }/${provider.version?.replace("v", "")}/docs/${type}s/${name}`;

  return { rawDocUrl, docUrl };
};

function DetailDoc(props: { item: TFElement }) {
  const rawDocUrl = props.item.rawDocUrl || "";
  const { isLoading, data } = useFetch(rawDocUrl, {
    keepPreviousData: true,
  });

  return (
    <Detail
      isLoading={isLoading}
      // remove frontmatter
      markdown={((data as string) || "").replace(/---[\s\S]*?---\n/g, "")}
      navigationTitle={`${props.item.provider.name}_${props.item.name}`}
    />
  );
}

const checkIsOldDocsPaths = async (provider: TFProvider) => {
  const url = `https://api.github.com/repos/${provider.owner}/terraform-provider-${provider.name}/contents/`;
  return fetch(url)
    .then((res) => {
      if (res.status === 404) {
        showToast({
          style: Toast.Style.Failure,
          title: "Not Found",
          message: `${provider.owner}/${provider.name} is not found`,
        });
      }
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      // data is an array of GitHubFileInfo. Check if the path "website" exists
      if ((data as GitHubFileInfo[]).find((item) => item.name === "website")) {
        return true;
      }
      return false;
    });
};

const fetchAPIs = async (providerNames: string[]) => {
  const checks = async (providers: string[]) => {
    const ch = providers.map(async (p) => {
      try {
        const isOldDocsPaths = await checkIsOldDocsPaths({
          owner: p.split("/")[0],
          name: p.split("/")[1],
          isOldDocsPaths: false,
        });
        return {
          owner: p.split("/")[0],
          name: p.split("/")[1],
          isOldDocsPaths: isOldDocsPaths,
        };
      } catch (error) {
        showToast({ style: Toast.Style.Failure, title: "Failed to fetch versions", message: "fail" });
        return {} as TFProvider;
      }
    });
    const res = await Promise.all(ch);
    return res.filter((p) => p !== ({} as TFProvider));
  };
  const providers = await checks(providerNames);

  const fetchVersions = providers.map(async (provider) => {
    const url = `https://api.github.com/repos/${provider.owner}/terraform-provider-${provider.name}/tags`;
    return fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        const latestTag = (data as GitHubTagInfo[])[0];
        console.log(latestTag);
        provider.version = latestTag.name;
        return provider;
      })
      .catch((error) => {
        showToast({ style: Toast.Style.Failure, title: "Failed to fetch versions", message: error.message });
        return provider;
      });
  });
  await Promise.all(fetchVersions);

  const fetches = providers
    .flatMap((provider) => [
      {
        provider: provider,
        type: TFElementType.Resource,
      },
      {
        provider: provider,
        type: TFElementType.DataSource,
      },
    ])
    .map((p) =>
      fetch(generateTFGitHubURL(p.provider, p.type))
        .then((res) => res.json())
        .then((data) =>
          (data as GitHubFileInfo[]).map((item: GitHubFileInfo) => {
            return {
              name: item.name.split(".")[0],
              type: p.type,
              provider: p.provider,
              rawDocUrl: item.download_url,
            } as TFElement;
          }),
        )
        .catch((error) => {
          console.error(error);
          return [];
        }),
    );

  const results: TFElement[][] = await Promise.all(fetches);
  return results.flat();
};
