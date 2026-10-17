import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { usePublicCategories, Category } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";
import { ChevronRight, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useTranslatedList } from "@/hooks/useTranslatedContent";
import { useSEO } from "@/hooks/useSEO";
import { useBranding } from "@/hooks/useBranding";
import { useTranslation } from "react-i18next";

const CategoryTile = ({ cat, label, onClick, size = "md" }: { cat: Category; label: string; onClick: () => void; size?: "md" | "lg" }) => (
  <button onClick={onClick} className="group flex flex-col items-center gap-2 text-center">
    <div
      className={cn(
        "rounded-full bg-muted flex items-center justify-center overflow-hidden ring-1 ring-border transition-all group-hover:ring-primary group-hover:shadow-md",
        size === "lg" ? "w-24 h-24" : "w-16 h-16"
      )}
    >
      {cat.icon ? (
        <img src={cat.icon} alt={label} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xl font-semibold text-muted-foreground">{label.charAt(0).toUpperCase()}</span>
      )}
    </div>
    <span className="text-[11px] md:text-sm leading-tight line-clamp-2 font-medium text-foreground">{label}</span>
  </button>
);

const CategoriesPage = () => {
  const { t } = useTranslation();
  const { getValue } = useBranding();
  useSEO({
    title: t("pagesExtra.categories.categoriesLabel") + " · Kizkka",
    description: t("categoriesNav.explore"),
    type: "website",
    image: getValue("share_image_url") || getValue("logo_url") || getValue("favicon_url"),
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories = [], isLoading } = usePublicCategories();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const { getTranslated } = useTranslatedList("category", categories, (cat) => ({ name: cat.name }));
  const tName = (cat?: Category | null) => (cat ? getTranslated(cat).name || cat.name : "");

  const roots = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
  const selectedRoot = roots.find((c) => c.id === searchParams.get("cat")) || roots[0];
  const children = selectedRoot ? childrenOf(selectedRoot.id) : [];
  const go = (c: Category) => navigate(`/categoria/${c.slug}`);

  const q = query.trim().toLowerCase();
  const matches = q ? categories.filter((c) => tName(c).toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : [];

  const selectRoot = (id: string) => setSearchParams({ cat: id }, { replace: true });

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("categoriesNav.search")} className="pl-9 h-10 rounded-full bg-muted border-0" />
    </div>
  );

  const searchResults = (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-x-3 gap-y-5">
      {matches.length ? matches.map((c) => <CategoryTile key={c.id} cat={c} label={tName(c)} onClick={() => go(c)} />) : (
        <p className="col-span-full text-center text-sm text-muted-foreground py-10">{t("categoriesNav.noResults")}</p>
      )}
    </div>
  );

  const content = selectedRoot && (
    <div className="space-y-5">
      <button onClick={() => go(selectedRoot)} className="w-full flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3 text-left">
        <span className="font-semibold text-sm md:text-base text-foreground">{t("categoriesNav.shopAll", { name: tName(selectedRoot) })}</span>
        <ChevronRight className="w-4 h-4 text-primary" />
      </button>
      {children.length > 0 ? (
        <div className={cn("grid gap-x-3 gap-y-5", isMobile ? "grid-cols-3" : "grid-cols-4 lg:grid-cols-6")}>
          {children.map((c) => <CategoryTile key={c.id} cat={c} label={tName(c)} onClick={() => go(c)} size={isMobile ? "md" : "lg"} />)}
        </div>
      ) : (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <p>{t("pagesExtra.categories.noSubcategoriesInCategory")}</p>
          <button onClick={() => go(selectedRoot)} className="mt-3 text-primary font-medium">
            {t("pagesExtra.categories.viewProductsIn", { name: tName(selectedRoot) })}
          </button>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {!isMobile && <GlobalHeader />}
        <div className="flex gap-3 p-4">
          <div className="w-24 space-y-2">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          <div className="flex-1 grid grid-cols-3 gap-4">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-full" />)}</div>
        </div>
      </div>
    );
  }

  const rail = (
    <nav aria-label={t("categoriesNav.departments")}>
      {roots.map((c) => {
        const active = c.id === selectedRoot?.id;
        return (
          <button
            key={c.id}
            onClick={() => selectRoot(c.id)}
            className={cn(
              "w-full border-l-4 px-2 md:px-4 py-3 text-xs md:text-sm text-left transition-colors min-h-[52px]",
              active ? "bg-background border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:bg-background/60"
            )}
          >
            {tName(c)}
            {!isMobile && <span className="block text-[11px] font-normal text-muted-foreground">{t("categoriesNav.subcount", { count: childrenOf(c.id).length })}</span>}
          </button>
        );
      })}
    </nav>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100dvh-110px)] bg-background overflow-hidden">
        <div className="px-3 py-2 border-b border-border">{searchBox}</div>
        {q ? (
          <main className="flex-1 overflow-y-auto p-4 pb-24">{searchResults}</main>
        ) : (
          <div className="flex flex-1 min-h-0">
            <aside className="w-[104px] shrink-0 bg-muted overflow-y-auto scrollbar-hide">{rail}</aside>
            <main className="flex-1 overflow-y-auto p-3 pb-24 scrollbar-hide">{content}</main>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <GlobalHeader />
      <main className="container mx-auto px-4 pb-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <button onClick={() => navigate("/")} className="hover:text-primary">{t("pagesExtra.categories.home")}</button>
          <ChevronRight className="w-4 h-4" />
          <span>{t("pagesExtra.categories.categoriesLabel")}</span>
          {selectedRoot && !q && (<><ChevronRight className="w-4 h-4" /><span className="text-foreground">{tName(selectedRoot)}</span></>)}
        </div>
        <div className="flex items-center justify-between gap-4 mb-5">
          <h1 className="text-2xl font-bold text-foreground">{t("categoriesNav.explore")}</h1>
          <div className="w-80">{searchBox}</div>
        </div>
        <div className="flex gap-6 bg-card rounded-2xl shadow-xs overflow-hidden min-h-[560px]">
          {q ? (
            <div className="flex-1 p-6">{searchResults}</div>
          ) : (
            <>
              <aside className="w-60 shrink-0 bg-muted py-2">{rail}</aside>
              <section className="flex-1 p-6">{content}</section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CategoriesPage;
