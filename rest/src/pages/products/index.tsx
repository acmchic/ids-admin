import Card from "@components/common/card";
import Layout from "@components/layouts/admin";
import Search from "@components/common/search";
import ProductList from "@components/product/product-list";
import ErrorMessage from "@components/ui/error-message";
import Loader from "@components/ui/loader/loader";
import { SortOrder } from "@ts-types/generated";
import { FormEvent, useState } from "react";
import { useProductsQuery } from "@data/product/products.query";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import CategoryTypeFilter from "@components/product/category-type-filter";
import cn from "classnames";
import { ArrowDown } from "@components/icons/arrow-down";
import { ArrowUp } from "@components/icons/arrow-up";
import {adminOnly} from "@utils/auth-utils";
import Button from "@components/ui/button";
import { useBulkDraftProductsMutation } from "@data/product/product-bulk-draft.mutation";

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [slugTerm, setSlugTerm] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const { t } = useTranslation();
  const [orderBy, setOrder] = useState("created_at");
  const [sortedBy, setColumn] = useState<SortOrder>(SortOrder.Desc);
  const [visible, setVisible] = useState(false);
  const { mutate: bulkDraftProducts, isLoading: bulkDrafting } =
    useBulkDraftProductsMutation();

  console.log(sortedBy);

  const toggleVisible = () => {
    setVisible((v) => !v);
  };

  const {
    data,
    isLoading: loading,
    error,
  } = useProductsQuery({
    limit: 20,
    page,
    type,
    category,
    slug: slugTerm,
    text: searchTerm,
    orderBy,
    sortedBy,
  });

  if (loading) return <Loader text={t("common:text-loading")} />;
  if (error) return <ErrorMessage message={error.message} />;

  function handleSearch({ searchText }: { searchText: string }) {
    setSearchTerm(searchText);
    setPage(1);
    setSelectedSlugs([]);
  }
  function handleSlugSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSlugTerm(slugInput.trim());
    setPage(1);
    setSelectedSlugs([]);
  }
  function handleClearSlugSearch() {
    setSlugInput("");
    setSlugTerm("");
    setPage(1);
    setSelectedSlugs([]);
  }
  function handleBulkDraft() {
    if (selectedSlugs.length === 0) {
      return;
    }

    bulkDraftProducts(
      { slugs: selectedSlugs },
      {
        onSuccess: () => {
          setSelectedSlugs([]);
        },
      }
    );
  }
  function handlePagination(current: any) {
    setPage(current);
  }
  return (
    <>
      <Card className="flex flex-col mb-8">
        <div className="w-full flex flex-col md:flex-row items-center">
          <div className="md:w-1/4 mb-4 md:mb-0">
            <h1 className="text-lg font-semibold text-heading">
              {t("form:input-label-products")}
            </h1>
          </div>

          <div className="w-full md:w-3/4 flex flex-col items-center ms-auto">
            <Search onSearch={handleSearch} />
          </div>

          <button
            className="text-accent text-base font-semibold flex items-center md:ms-5 mt-5 md:mt-0"
            onClick={toggleVisible}
          >
            {t("common:text-filter")}{" "}
            {visible ? (
              <ArrowUp className="ms-2" />
            ) : (
              <ArrowDown className="ms-2" />
            )}
          </button>
        </div>

        <form
          className="w-full flex flex-col md:flex-row gap-3 mt-5"
          onSubmit={handleSlugSearch}
        >
          <input
            type="text"
            value={slugInput}
            onChange={(event) => setSlugInput(event.target.value)}
            className="px-4 h-12 w-full rounded border border-border-base text-heading text-sm focus:outline-none focus:border-accent"
            placeholder="Filter by product slug or product URL"
            aria-label="Filter by product slug"
            autoComplete="off"
          />
          <div className="flex gap-3">
            <Button type="submit" className="whitespace-nowrap">
              Filter slug
            </Button>
            {!!slugTerm && (
              <Button
                type="button"
                variant="outline"
                className="whitespace-nowrap"
                onClick={handleClearSlugSearch}
              >
                Clear
              </Button>
            )}
          </div>
        </form>

        {selectedSlugs.length > 0 && (
          <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-200 pt-5">
            <p className="text-sm font-semibold text-heading">
              Selected {selectedSlugs.length} product{selectedSlugs.length === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              onClick={handleBulkDraft}
              loading={bulkDrafting}
              disabled={bulkDrafting}
            >
              Move selected to draft
            </Button>
          </div>
        )}

        <div
          className={cn("w-full flex transition", {
            "h-auto visible": visible,
            "h-0 invisible": !visible,
          })}
        >
          <div className="flex flex-col md:flex-row md:items-center mt-5 md:mt-8 border-t border-gray-200 pt-5 md:pt-8 w-full">
            <CategoryTypeFilter
              className="w-full"
              onCategoryFilter={({ slug }: { slug: string }) => {
                setCategory(slug);
              }}
              onTypeFilter={({ slug }: { slug: string }) => {
                setType(slug);
              }}
            />
          </div>
        </div>
      </Card>
      <ProductList
        products={data?.products}
        onPagination={handlePagination}
        onOrder={setOrder}
        onSort={setColumn}
        selectedSlugs={selectedSlugs}
        onSelectedSlugsChange={setSelectedSlugs}
      />
    </>
  );
}

ProductsPage.authenticate = {
  permissions: adminOnly,
};
ProductsPage.Layout = Layout;

export const getStaticProps = async ({ locale }: any) => ({
  props: {
    ...(await serverSideTranslations(locale, ["table", "common", "form"])),
  },
});
