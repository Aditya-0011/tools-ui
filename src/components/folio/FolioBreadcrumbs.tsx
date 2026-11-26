import { Fragment } from "react";
import { Link } from "react-router";

import { useFolio } from "@/hooks/use-folio";
import { ancestorsOf, canonicalFolder, folderName } from "@/lib/folio/paths";
import { cn } from "@/lib/utils";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const pageClass = "truncate font-medium text-neutral-100";
const linkClass = "truncate hover:text-violet-300";

export function FolioBreadcrumbs({
  folder,
  current,
  className,
}: {
  folder: string;
  current?: string;
  className?: string;
}) {
  const { tree, folderHref } = useFolio();
  const path = canonicalFolder(tree, folder);
  const segments = ancestorsOf(path);
  const crumbs = [
    { key: "", label: "All notes" },
    ...segments.map((segment) => ({
      key: segment,
      label: folderName(segment),
    })),
  ];
  const pageLabel = current ?? crumbs.at(-1)?.label ?? "All notes";
  const links = current === undefined ? crumbs.slice(0, -1) : crumbs;

  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList className="flex-nowrap gap-1 text-sm sm:gap-1.5">
        {links.map((crumb) => (
          <Fragment key={crumb.key}>
            <BreadcrumbItem className="min-w-0 shrink max-md:hidden">
              <BreadcrumbLink
                render={<Link to={folderHref(crumb.key)} />}
                className={linkClass}
              >
                {crumb.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="max-md:hidden" />
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0 shrink-[0.5]">
          <BreadcrumbPage className={pageClass}>{pageLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
