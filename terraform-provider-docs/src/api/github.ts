import { showToast, Toast } from "@raycast/api";
import {
  getTerraformGitHubContentsParentURL,
  TerraformElement,
  TerraformElementType,
  TerraformProvider,
} from "../helpers/terraform";
import { getTerraformGitHubContentsURL, terraformDocsPathsSpec } from "../helpers/terraform";
import fetch from "node-fetch";
import { get } from "http";

interface GitHubLinks {
  self: string;
  git: string;
  html: string;
}

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

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeInfo[];
  truncated: boolean;
}

interface GitHubTreeInfo {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size: number;
  url: string;
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

export async function fetchTerraformElements(providerNames: string[]) {
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
        return {} as TerraformProvider;
      }
    });
    const res = await Promise.all(ch);
    return res.filter((p) => p !== ({} as TerraformProvider));
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

  const fetchShas = providers.flatMap(async (provider) => {
    return fetch(getTerraformGitHubContentsParentURL(provider))
      .then((res) => res.json())
      .then((data) => {
        const pathSpec = provider.isOldDocsPaths ? "old" : "new";
        const resourceSha = (data as GitHubFileInfo[]).find(
          (item) => item.name === terraformDocsPathsSpec[pathSpec].resourceDir,
        )?.sha;
        const dataSha = (data as GitHubFileInfo[]).find(
          (item) => item.name === terraformDocsPathsSpec[pathSpec].resourceDir,
        )?.sha;
        return [
          {
            provider: provider,
            type: TerraformElementType.Resource,
            sha: resourceSha,
          },
          {
            provider: provider,
            type: TerraformElementType.DataSource,
            sha: dataSha,
          },
        ];
      });
  });
  const fetchSources = (await Promise.all(fetchShas)).flat();

  const fetches = fetchSources.map((p) =>
    fetch(getGitHubTreeURL(p.provider, p.sha || ""))
      .then((res) => res.json())
      .then((data) =>
        (data as GitHubTreeResponse).tree.map((item: GitHubTreeInfo) => {
          const ret = {
            name: item.path.split(".")[0],
            type: p.type,
            provider: p.provider,
          } as TerraformElement;
          ret.rawDocUrl = getRawDocURL(ret);
          return ret;
        }),
      )
      .catch((error) => {
        console.error(error);
        return [];
      }),
  );

  const results: TerraformElement[][] = await Promise.all(fetches);
  return results.flat();
}

const checkIsOldDocsPaths = async (provider: TerraformProvider) => {
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

const getGitHubTreeURL = (provider: TerraformProvider, sha: string) => {
  return `https://api.github.com/repos/${provider.owner}/terraform-provider-${provider.name}/git/trees/${sha}?ref=${provider.version}&recursive=false`;
};

const getRawDocURL = (item: TerraformElement) => {
  const pathSpec = item.provider.isOldDocsPaths ? "old" : "new";
  const dir =
    item.type === TerraformElementType.Resource
      ? terraformDocsPathsSpec[pathSpec].resourceDir
      : terraformDocsPathsSpec[pathSpec].dataSourceDir;
  return `https://raw.githubusercontent.com/${item.provider.owner}/terraform-provider-${item.provider.name}/${item.provider.version}/${terraformDocsPathsSpec[pathSpec].parentDir}/${dir}/${item.name}${terraformDocsPathsSpec[pathSpec].suffix}`;
};
