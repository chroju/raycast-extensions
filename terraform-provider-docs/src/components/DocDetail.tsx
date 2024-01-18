import { Detail, showToast, Toast } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { TerraformElement } from "../helpers/terraform";
import { AddRecentView } from "../helpers/recentViews";

type DocDetailProps = {
  element: TerraformElement;
};

export function DocDetail({ element }: DocDetailProps) {
  const rawDocUrl = element.rawDocUrl || "";
  const { isLoading, data } = useFetch(rawDocUrl, {
    keepPreviousData: true,
    onError: (error) => {
      console.error(error);
      showToast({ style: Toast.Style.Failure, title: "Failed to get document" });
    },
  });
  AddRecentView(element);

  return (
    <Detail
      isLoading={isLoading}
      // remove frontmatter
      markdown={((data as string) || "").replace(/---[\s\S]*?---\n/g, "")}
      navigationTitle={`${element.provider.name}_${element.name}`}
    />
  );
}
