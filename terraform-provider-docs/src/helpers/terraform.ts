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

export const terraformDocsPathsSpec: { old: terraformDocsPaths; new: terraformDocsPaths } = {
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

export const getTerraformDocURL = (item: TerraformElement) => {
  const { provider, name, type } = item;

  return `https://registry.terraform.io/providers/${provider.owner}/${provider.name}/${provider.version?.replace(
    "v",
    "",
  )}/docs/${type.toLowerCase().replace(" ", "-")}s/${name}`;
};
