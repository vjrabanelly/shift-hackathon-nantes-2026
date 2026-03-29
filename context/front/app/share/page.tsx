import { redirect } from "next/navigation";

type SharePageProps = {
    searchParams: Promise<{
        title?: string;
        text?: string;
        url?: string;
    }>;
};

export default async function SharePage({ searchParams }: SharePageProps) {
    const { title, text, url } = await searchParams;

    let target = null;

    if (url) {
        target = `/results?url=${encodeURIComponent(url)}`
    }
    if (text) {
        target = `/results?url=${encodeURIComponent(text)}`
    }
    if (target) {
        if (title) {
            target += `&title=${encodeURIComponent(title)}`
        }
        console.log("Redirecting to results page with URL:", target);
        redirect(target);
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Received share data:</h1>
            <p>Titre : {title ?? "-"}</p>
            <p>Lien : {url ?? "-"}</p>
            <p>Texte : {text ?? "-"}</p>
        </div>
    );
}
