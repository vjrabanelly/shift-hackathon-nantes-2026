import { redirect } from "next/navigation";
import ResultsExperience from "@/components/custom/ResultsExperience";
import { inputExample } from "@/lib/input-example";

export default async function ResultsPage({
    searchParams
}: {
    searchParams: Promise<{ url?: string; title?: string }>;
}) {
    const { url, title } = await searchParams;

    if (!url) {
        redirect("/search");
    }

    const exampleArticle = inputExample.find((article) => article.url === url);

    return (
        <ResultsExperience
            url={url}
            title={title}
            exampleArticle={exampleArticle}
        />
    );
}
