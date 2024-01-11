export enum TerraformElementType {
  Resource = "Resource",
  DataSource = "Data Source",
}

export interface TerraformProvider {
  owner: string;
  name: string;
  version?: string;
  isOldDocsPaths: boolean;
}

export interface TerraformElement {
  name: string;
  type: TerraformElementType;
  provider: TerraformProvider;
  rawDocUrl?: string;
}

interface terraformDocsPaths {
  parentDir: string;
  resourceDir: string;
  dataSourceDir: string;
  suffix: string;
}

const terraformDocsPathsSpec: { old: terraformDocsPaths; new: terraformDocsPaths } = {
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

export const getTerraformGitHubContentsURL = (item: TerraformProvider, type: TerraformElementType): string => {
  const { owner, name, isOldDocsPaths } = item;
  const pathSpec = isOldDocsPaths ? "old" : "new";
  const dir =
    type === TerraformElementType.Resource
      ? terraformDocsPathsSpec[pathSpec].resourceDir
      : terraformDocsPathsSpec[pathSpec].dataSourceDir;

  return `https://api.github.com/repos/${owner}/terraform-provider-${name}/contents/${terraformDocsPathsSpec[pathSpec].parentDir}/${dir}?ref=${item.version}`;
};

export const getTerraformDocURL = (item: TerraformElement) => {
  const { provider, name, type } = item;

  return `https://registry.terraform.io/providers/${provider.owner}/${provider.name}/${provider.version?.replace(
    "v",
    "",
  )}/docs/${type}s/${name}`;
};
