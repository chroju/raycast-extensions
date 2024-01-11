import { Detail } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { TerraformElement } from "../helpers/terraform";

type DocDetailProps = {
  element: TerraformElement;
};

export function DocDetail({ element }: DocDetailProps) {
  const rawDocUrl = element.rawDocUrl || "";
  const { isLoading, data } = useFetch(rawDocUrl, {
    keepPreviousData: true,
  });

  return (
    <Detail
      isLoading={isLoading}
      // remove frontmatter
      markdown={((data as string) || "").replace(/---[\s\S]*?---\n/g, "")}
      navigationTitle={`${element.provider.name}_${element.name}`}
    />
  );
}
