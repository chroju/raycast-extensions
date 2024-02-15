import { showToast, Toast } from "@raycast/api";
import { TerraformElement, TerraformElementType, TerraformProvider } from "../helpers/terraform";
import { terraformDocsPathsSpec } from "../helpers/terraform";
import fetch from "node-fetch";

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

export async function getTerraformProviderFromName(owner: string, name: string) {
  const provider: TerraformProvider = {
    owner: owner,
    name: name,
    version: "",
    isOldDocsPaths: false,
  };
  return checkIsOldDocsPaths(provider)
    .then((isOldDocsPaths) => {
      provider.isOldDocsPaths = isOldDocsPaths;
      const url = `https://api.github.com/repos/${provider.owner}/terraform-provider-${provider.name}/tags`;
      return fetch(url);
    })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      const latestTag = (data as GitHubTagInfo[])[0];
      provider.version = latestTag.name;
      return provider;
    })
    .catch((error) => {
      throw new Error(error.message);
    });
}

export async function getTerraformElements(provider: TerraformProvider) {
  const pathSpec = provider.isOldDocsPaths ? "old" : "new";
  const shaMap = await fetch(getTerraformGitHubContentsParentURL(provider))
    .then((res) => res.json())
    .then((data) => {
      const resourceSha = (data as GitHubFileInfo[]).find(
        (item) => item.name === terraformDocsPathsSpec[pathSpec].resourceDir,
      )?.sha;
      const dataSha = (data as GitHubFileInfo[]).find(
        (item) => item.name === terraformDocsPathsSpec[pathSpec].dataSourceDir,
      )?.sha;
      return [
        {
          type: TerraformElementType.Resource,
          sha: resourceSha || "",
        },
        {
          type: TerraformElementType.DataSource,
          sha: dataSha || "",
        },
      ];
    });

  const elements = shaMap.map(async (shaInfo) => {
    if (shaInfo.sha === "") {
      return {} as TerraformElement;
    }
    return await fetch(getGitHubTreeURL(provider, shaInfo.sha))
      .then((res) => res.json())
      .then((data) =>
        (data as GitHubTreeResponse).tree.map((item: GitHubTreeInfo) => {
          const ret = {
            name: item.path.split(".")[0],
            type: shaInfo.type,
            provider: provider,
          } as TerraformElement;
          ret.rawDocUrl = getRawDocURL(ret);
          return ret;
        }),
      )
      .catch((error) => {
        throw new Error(error.message);
      });
  });
  return (await Promise.all(elements)).flat().filter((item) => Object.keys(item).length !== 0);
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

export const getTerraformGitHubContentsParentURL = (item: TerraformProvider): string => {
  const { owner, name, isOldDocsPaths } = item;
  const pathSpec = isOldDocsPaths ? "old" : "new";

  return `https://api.github.com/repos/${owner}/terraform-provider-${name}/contents/${terraformDocsPathsSpec[pathSpec].parentDir}/?ref=${item.version}`;
};

export const getTerraformGitHubContentsURL = (item: TerraformProvider, type: TerraformElementType): string => {
  const { owner, name, isOldDocsPaths } = item;
  const pathSpec = isOldDocsPaths ? "old" : "new";
  const dir =
    type === TerraformElementType.Resource
      ? terraformDocsPathsSpec[pathSpec].resourceDir
      : terraformDocsPathsSpec[pathSpec].dataSourceDir;

  return `https://api.github.com/repos/${owner}/terraform-provider-${name}/contents/${terraformDocsPathsSpec[pathSpec].parentDir}/${dir}?ref=${item.version}`;
};
