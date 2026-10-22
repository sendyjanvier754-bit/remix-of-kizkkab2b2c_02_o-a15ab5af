import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listPublishedNews, NEWS_CATEGORIES, type NewsArticle } from "@/lib/news.functions";
import { NewsShell, formatNewsDate, LANG_LABEL } from "@/components/news/NewsShell";
import { NewsSponsored } from "@/components/news/NewsSponsored";
import { Button } from "@/components/ui/button";
import { Newspaper, ShoppingBag } from "lucide-react";

const newsListQuery = (category: string) =>
  queryOptions({ queryKey: ["news", "list", category], queryFn: () => listPublishedNews({ data: { category } }) });

const TITLE = "Noticias de negocios para Haití y la diáspora | Kizkka";
const DESC = "Actualidad de negocios, comercio internacional, importación y logística para emprendedores haitianos en Haití y el mundo.";

export const Route = createFileRoute("/noticias/")({
  validateSearch: (s: Record<string, unknown>) => ({ cat: typeof s.cat === "string" ? s.cat : "" }),
  loaderDeps: ({ search }) => ({ cat: search.cat }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(newsListQuery(deps.cat)),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://kizkka.com/noticias" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://kizkka.com/noticias" }],
  }),
  component: NewsIndex,
  errorComponent: ({ error }) => <NewsShell><p className="p-8 text-center">{error instanceof Error ? error.message : "Error"}</p></NewsShell>,
});

function Thumb({ a, className }: { a: NewsArticle; className: string }) {
  return a.cover_image ? (
    <img src={a.cover_image} alt={a.title} loading="lazy" className={`${className} object-cover bg-muted`} />
  ) : (
    <div className={`${className} bg-muted flex items-center justify-center text-muted-foreground`}><Newspaper className="h-6 w-6" /></div>
  );
}

function Meta({ a }: { a: NewsArticle }) {
  const { t, i18n } = useTranslation();
  return (
    <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
      <span className="font-semibold text-primary">{t(`news.cats.${a.category}`, NEWS_CATEGORIES[a.category] ?? a.category)}</span>
      <span>· {formatNewsDate(a.published_at, i18n.language)}</span>
      <span>· {LANG_LABEL[a.language] ?? a.language}</span>
    </p>
  );
}

function NewsIndex() {
  const { t } = useTranslation();
  const { cat } = Route.useSearch();
  const navigate = useNavigate({ from: "/noticias/" });
  const { data: news } = useSuspenseQuery(newsListQuery(cat));
  const featured = news.find((n) => n.is_featured) ?? news[0];
  const rest = news.filter((n) => n.id !== featured?.id);
  const side = rest.slice(0, 3);
  const feed = rest.slice(3);

  const tab = (key: string, label: string) => (
    <button key={key || "all"} onClick={() => navigate({ search: { cat: key } })}
      className={`whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition ${cat === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );

  return (
    <NewsShell>
      <div className="border-b bg-card">
        <div className="container mx-auto px-3 lg:px-4">
          <div className="flex items-baseline gap-3 pt-5">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{t("news.brand")}</h1>
            <p className="hidden md:block text-sm text-muted-foreground">{t("news.headline")}</p>
          </div>
          <nav className="flex overflow-x-auto -mb-px mt-2 scrollbar-none">
            {tab("", t("news.all"))}
            {Object.keys(NEWS_CATEGORIES).map((k) => tab(k, t(`news.cats.${k}`)))}
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-3 lg:px-4 pt-4 pb-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {!featured ? (
            <div className="text-center py-20 text-muted-foreground border rounded-xl">
              <Newspaper className="h-12 w-12 mx-auto mb-3" />
              {t("news.empty")}
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-[1.6fr_1fr] border-b pb-6">
                <Link to="/noticias/$slug" params={{ slug: featured.slug }} className="group block">
                  <Thumb a={featured} className="w-full aspect-[16/9] rounded-lg" />
                  <h2 className="text-2xl md:text-3xl font-extrabold leading-tight mt-3 group-hover:text-primary">{featured.title}</h2>
                  {featured.excerpt && <p className="text-muted-foreground mt-2 line-clamp-3">{featured.excerpt}</p>}
                  <div className="mt-2"><Meta a={featured} /></div>
                </Link>
                <div className="space-y-4 md:border-l md:pl-5">
                  {side.map((a) => (
                    <Link key={a.id} to="/noticias/$slug" params={{ slug: a.slug }} className="group flex gap-3">
                      <Thumb a={a} className="w-24 h-16 rounded shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug line-clamp-3 group-hover:text-primary">{a.title}</h3>
                        <Meta a={a} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {feed.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-lg font-bold mb-3">{t("news.latest")}</h2>
                  <div className="divide-y">
                    {feed.map((a, i) => (
                      <div key={a.id}>
                        <Link to="/noticias/$slug" params={{ slug: a.slug }} className="group flex gap-4 py-4">
                          <Thumb a={a} className="w-32 md:w-44 aspect-[16/10] rounded shrink-0" />
                          <div className="min-w-0">
                            <h3 className="font-bold leading-snug group-hover:text-primary line-clamp-2">{a.title}</h3>
                            {a.excerpt && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.excerpt}</p>}
                            <div className="mt-1"><Meta a={a} /></div>
                          </div>
                        </Link>
                        {i === 3 && <div className="py-4"><NewsSponsored layout="row" max={4} /></div>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="space-y-5">
          <NewsSponsored max={4} />
          {rest.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="font-bold text-sm uppercase tracking-wide mb-3">{t("news.mostRead")}</h3>
              <ol className="space-y-3">
                {[...news].slice(0, 5).map((a, i) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="text-2xl font-extrabold text-primary/40 w-6">{i + 1}</span>
                    <Link to="/noticias/$slug" params={{ slug: a.slug }} className="text-sm font-medium hover:text-primary line-clamp-3">{a.title}</Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </NewsShell>
  );
}
