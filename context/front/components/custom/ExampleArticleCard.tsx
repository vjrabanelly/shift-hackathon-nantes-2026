import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";

interface ExampleArticleCardProps {
    title: string;
    source: string;
    authors: string[];
    onClick: () => void;
}

export default function ExampleArticleCard({
    title,
    source,
    authors,
    onClick
}: ExampleArticleCardProps) {
    return (
        <Card
            size="sm"
            className="cursor-pointer hover:ring-blue-400 hover:shadow-md transition-shadow"
            onClick={onClick}>
            <CardHeader>
                <CardDescription>
                    {source}
                    {authors.length > 0 ? ` · ${authors.join(", ")}` : ""}
                </CardDescription>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
        </Card>
    );
}
