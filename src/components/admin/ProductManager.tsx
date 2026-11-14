"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { BottleSizeMl, ProductItem, ProductVariantItem } from "@/lib/db/schemas";

interface ProductWithVariantList extends ProductItem {
  variants?: ProductVariantItem[];
}

interface ProductManagerProps {
  initialProducts: ProductItem[];
  dbConfigured: boolean;
}

const STANDARD_PRICES: Record<BottleSizeMl, number> = {
  30: 400,
  50: 630,
  100: 1000,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function ProductManager({ initialProducts, dbConfigured }: ProductManagerProps) {
  const [products, setProducts] = useState<ProductWithVariantList[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [activeProduct, setActiveProduct] = useState<ProductWithVariantList | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Perfume");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [formGender, setFormGender] = useState("Unisex");
  const [formConcentration, setFormConcentration] = useState("Eau de Parfum");
  const [formFeatured, setFormFeatured] = useState(false);
  const [formBestseller, setFormBestseller] = useState(false);

  // Variant Form State: 30ml, 50ml, 100ml
  const [variant30Stock, setVariant30Stock] = useState<number>(0);
  const [variant30Price, setVariant30Price] = useState<number>(STANDARD_PRICES[30]);
  const [variant30Active, setVariant30Active] = useState<boolean>(true);

  const [variant50Stock, setVariant50Stock] = useState<number>(0);
  const [variant50Price, setVariant50Price] = useState<number>(STANDARD_PRICES[50]);
  const [variant50Active, setVariant50Active] = useState<boolean>(true);

  const [variant100Stock, setVariant100Stock] = useState<number>(0);
  const [variant100Price, setVariant100Price] = useState<number>(STANDARD_PRICES[100]);
  const [variant100Active, setVariant100Active] = useState<boolean>(true);

  // Refresh products list
  const refreshProducts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/products", {
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      setProducts(data.items || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error refreshing products");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode("CREATE");
    setActiveProduct(null);
    setFormName("");
    setFormId("");
    setFormDescription("");
    setFormCategory("Perfume");
    setFormStatus("ACTIVE");
    setFormGender("Unisex");
    setFormConcentration("Eau de Parfum");
    setFormFeatured(false);
    setFormBestseller(false);

    setVariant30Stock(0);
    setVariant30Price(STANDARD_PRICES[30]);
    setVariant30Active(true);

    setVariant50Stock(0);
    setVariant50Price(STANDARD_PRICES[50]);
    setVariant50Active(true);

    setVariant100Stock(0);
    setVariant100Price(STANDARD_PRICES[100]);
    setVariant100Active(true);

    setIsModalOpen(true);
    setErrorMessage(null);
  };

  const openEditModal = async (product: ProductItem) => {
    setModalMode("EDIT");
    setActiveProduct(product);
    setFormName(product.name);
    setFormId(product.id);
    setFormDescription(product.description || "");
    setFormCategory(product.category);
    setFormStatus(product.status);
    setFormGender(product.gender || "Unisex");
    setFormConcentration(product.concentration || "Eau de Parfum");
    setFormFeatured(product.featured || false);
    setFormBestseller(product.bestseller || false);

    // Fetch existing variants
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`);
      const data = await res.json();
      if (res.ok && data.variants) {
        const v30 = data.variants.find((v: ProductVariantItem) => v.sizeMl === 30);
        const v50 = data.variants.find((v: ProductVariantItem) => v.sizeMl === 50);
        const v100 = data.variants.find((v: ProductVariantItem) => v.sizeMl === 100);

        setVariant30Stock(v30?.stockQuantity ?? 0);
        setVariant30Price(v30?.priceInr ?? STANDARD_PRICES[30]);
        setVariant30Active(v30 ? v30.status === "ACTIVE" : true);

        setVariant50Stock(v50?.stockQuantity ?? 0);
        setVariant50Price(v50?.priceInr ?? STANDARD_PRICES[50]);
        setVariant50Active(v50 ? v50.status === "ACTIVE" : true);

        setVariant100Stock(v100?.stockQuantity ?? 0);
        setVariant100Price(v100?.priceInr ?? STANDARD_PRICES[100]);
        setVariant100Active(v100 ? v100.status === "ACTIVE" : true);
      }
    } catch {
      // Fallback to standard defaults
      setVariant30Stock(0);
      setVariant30Price(STANDARD_PRICES[30]);
      setVariant30Active(true);
      setVariant50Stock(0);
      setVariant50Price(STANDARD_PRICES[50]);
      setVariant50Active(true);
      setVariant100Stock(0);
      setVariant100Price(STANDARD_PRICES[100]);
      setVariant100Active(true);
    }

    setIsModalOpen(true);
    setErrorMessage(null);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (modalMode === "CREATE") {
      setFormId(slugify(val));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const variantsPayload = [
      {
        sizeMl: 30 as BottleSizeMl,
        priceInr: Number(variant30Price),
        stockQuantity: Math.max(0, Number(variant30Stock) || 0),
        status: variant30Active ? ("ACTIVE" as const) : ("INACTIVE" as const),
      },
      {
        sizeMl: 50 as BottleSizeMl,
        priceInr: Number(variant50Price),
        stockQuantity: Math.max(0, Number(variant50Stock) || 0),
        status: variant50Active ? ("ACTIVE" as const) : ("INACTIVE" as const),
      },
      {
        sizeMl: 100 as BottleSizeMl,
        priceInr: Number(variant100Price),
        stockQuantity: Math.max(0, Number(variant100Stock) || 0),
        status: variant100Active ? ("ACTIVE" as const) : ("INACTIVE" as const),
      },
    ];

    try {
      if (modalMode === "CREATE") {
        const payload = {
          id: formId.trim(),
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          category: formCategory.trim() || "Perfume",
          status: formStatus,
          sizes: [30, 50, 100] as BottleSizeMl[],
          gender: formGender,
          concentration: formConcentration,
          featured: formFeatured,
          bestseller: formBestseller,
          variants: variantsPayload,
        };

        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Failed to create product");

        setSuccessMessage(`Fragrance "${formName}" created successfully.`);
        setIsModalOpen(false);
        await refreshProducts();
      } else {
        if (!activeProduct) return;

        const payload = {
          version: activeProduct.version,
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory.trim() || "Perfume",
          status: formStatus,
          sizes: [30, 50, 100] as BottleSizeMl[],
          gender: formGender,
          concentration: formConcentration,
          featured: formFeatured,
          bestseller: formBestseller,
          variants: variantsPayload,
        };

        const res = await fetch(`/api/admin/products/${encodeURIComponent(activeProduct.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Failed to update product");

        setSuccessMessage(`Fragrance "${formName}" updated successfully.`);
        setIsModalOpen(false);
        await refreshProducts();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId: string, version: number) => {
    if (!confirm(`Are you sure you want to delete fragrance "${productId}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(productId);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(productId)}?version=${encodeURIComponent(version)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to delete product");

      setSuccessMessage(`Fragrance "${productId}" deleted.`);
      await refreshProducts();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error deleting product");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (product: ProductItem) => {
    const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: product.version,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to update status");

      setSuccessMessage(`Fragrance "${product.name}" set to ${nextStatus}.`);
      await refreshProducts();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error updating status");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalActive = products.filter((p) => p.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">
              Fragrances & Products
            </h1>
            <span className="rounded-full bg-[#F3EDE2] px-2.5 py-0.5 text-xs font-semibold text-[#8C6D37]">
              Phase 2
            </span>
          </div>
          <p className="mt-1 text-sm text-[#57534E]">
            Manage fragrance catalogue, bottle sizes (30 ml, 50 ml, 100 ml), stock quantities and standard pricing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshProducts}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E4DA] bg-white px-3 py-2 text-xs font-medium text-[#292D27] shadow-sm transition hover:bg-[#F8F5EC] disabled:opacity-50"
            title="Refresh product list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-[#292D27]"
          >
            <Plus className="h-4 w-4 text-[#C6A76A]" />
            New Fragrance
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="flex-1">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* System & Table Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Total Fragrances</div>
          <div className="mt-2 text-2xl font-bold text-[#171717]">{products.length}</div>
          <div className="mt-1 text-xs text-[#78716C]">In DynamoDB partition</div>
        </div>

        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Active Fragrances</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{totalActive}</div>
          <div className="mt-1 text-xs text-[#78716C]">Available on storefront</div>
        </div>

        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Confirmed Sizes</div>
          <div className="mt-2 text-sm font-semibold text-[#171717]">30 ml • 50 ml • 100 ml</div>
          <div className="mt-1 text-xs text-[#78716C]">Spray bottle sizes</div>
        </div>

        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Standard Pricing</div>
          <div className="mt-2 text-sm font-semibold text-[#8C6D37]">₹400 • ₹630 • ₹1,000</div>
          <div className="mt-1 text-xs text-[#78716C]">Confirmed standard rates</div>
        </div>
      </div>

      {/* Database Warning if Not Configured */}
      {!dbConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">DynamoDB table configuration pending</div>
          <p className="mt-1 text-xs text-amber-800">
            Set <code className="font-mono">DYNAMODB_TABLE=luftansa-store</code> and{" "}
            <code className="font-mono">DYNAMODB_REGION=ap-south-2</code> to enable live database writes.
          </p>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E8E4DA] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A29E]" />
          <input
            type="text"
            placeholder="Search fragrance by name, slug or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] py-2 pl-9 pr-4 text-xs text-[#171717] placeholder-[#A8A29E] focus:border-[#C6A76A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === filter
                  ? "bg-[#171717] text-[#C6A76A]"
                  : "bg-[#F8F5EC] text-[#57534E] hover:bg-[#EFE9DC]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Product Table */}
      <div className="overflow-hidden rounded-xl border border-[#E8E4DA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8E4DA] bg-[#F8F5EC] text-[#57534E]">
              <tr>
                <th className="px-4 py-3 font-semibold">Fragrance</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Variants (30ml / 50ml / 100ml)</th>
                <th className="px-4 py-3 font-semibold">Version</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E4DA] text-[#292D27]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Package className="mx-auto h-10 w-10 text-[#C6A76A]/60" />
                    <h3 className="mt-3 font-serif text-base font-semibold text-[#171717]">
                      {products.length === 0 ? "No fragrances in database yet" : "No matching fragrances"}
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-[#78716C]">
                      {products.length === 0
                        ? "Product management foundation is ready on DynamoDB (ap-south-2). Create your first fragrance or await confirmed bulk insertion."
                        : "Try clearing your search term or status filter."}
                    </p>
                    {products.length === 0 && (
                      <button
                        onClick={openCreateModal}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#292D27]"
                      >
                        <Plus className="h-3.5 w-3.5 text-[#C6A76A]" />
                        Add First Fragrance
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="transition hover:bg-[#FFFDF8]">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[#171717]">{p.name}</div>
                      <div className="font-mono text-[11px] text-[#78716C]">{p.id}</div>
                      {p.featured && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-[#FDF6E8] px-1.5 py-0.5 text-[10px] font-medium text-[#8C6D37]">
                          <Sparkles className="h-2.5 w-2.5" /> Featured
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-[#F8F5EC] px-2 py-0.5 text-[11px] font-medium text-[#57534E]">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                          p.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                        title="Click to toggle status"
                      >
                        {p.status === "ACTIVE" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-stone-500" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#F8F5EC] px-1.5 py-0.5 text-[#292D27]">
                          30ml: ₹{STANDARD_PRICES[30]}
                        </span>
                        <span className="rounded bg-[#F8F5EC] px-1.5 py-0.5 text-[#292D27]">
                          50ml: ₹{STANDARD_PRICES[50]}
                        </span>
                        <span className="rounded bg-[#F8F5EC] px-1.5 py-0.5 text-[#292D27]">
                          100ml: ₹{STANDARD_PRICES[100]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#78716C]">
                      v{p.version}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded p-1.5 text-[#57534E] hover:bg-[#F8F5EC] hover:text-[#171717]"
                          title="Edit fragrance"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.version)}
                          disabled={deletingId === p.id}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Delete fragrance"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E8E4DA] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#171717]">
                  {modalMode === "CREATE" ? "Add New Fragrance" : `Edit Fragrance: ${activeProduct?.name}`}
                </h2>
                <p className="mt-0.5 text-xs text-[#78716C]">
                  {modalMode === "CREATE"
                    ? "Create product item and variants with confirmed standard pricing."
                    : `Optimistic version: v${activeProduct?.version}. Edits check version to prevent overwrites.`}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-[#78716C] hover:bg-[#F8F5EC] hover:text-[#171717]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#292D27]">Fragrance Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Black Velvet"
                    className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292D27]">
                    Slug / Identifier * {modalMode === "EDIT" && "(Immutable)"}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === "EDIT"}
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="e.g. black-velvet"
                    className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs font-mono text-[#171717] disabled:bg-stone-100 focus:border-[#C6A76A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292D27]">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Fragrance notes, personality, mood..."
                  className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292D27]">Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Perfume"
                    className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292D27]">Gender</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                  >
                    <option value="Unisex">Unisex</option>
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292D27]">Concentration</label>
                  <input
                    type="text"
                    value={formConcentration}
                    onChange={(e) => setFormConcentration(e.target.value)}
                    placeholder="Eau de Parfum"
                    className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 rounded-lg border border-[#E8E4DA] bg-[#F8F5EC] p-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formStatus === "ACTIVE"}
                    onChange={(e) => setFormStatus(e.target.checked ? "ACTIVE" : "INACTIVE")}
                    className="rounded border-[#E8E4DA] text-[#C6A76A] focus:ring-[#C6A76A]"
                  />
                  <span className="font-medium text-[#292D27]">Active on Storefront</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    className="rounded border-[#E8E4DA] text-[#C6A76A] focus:ring-[#C6A76A]"
                  />
                  <span className="font-medium text-[#292D27]">Featured Fragrance</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formBestseller}
                    onChange={(e) => setFormBestseller(e.target.checked)}
                    className="rounded border-[#E8E4DA] text-[#C6A76A] focus:ring-[#C6A76A]"
                  />
                  <span className="font-medium text-[#292D27]">Bestseller</span>
                </label>
              </div>

              {/* Variants Section */}
              <div className="space-y-3 border-t border-[#E8E4DA] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                    Bottle Variants & Inventory
                  </h3>
                  <span className="text-[11px] text-[#8C6D37]">Confirmed Standard Prices</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* 30 ml */}
                  <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-3">
                    <div className="flex items-center justify-between font-semibold text-[#171717]">
                      <span>30 ml Spray</span>
                      <span className="text-[#8C6D37]">₹{variant30Price}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="text-[11px] text-[#78716C]">Stock Quantity</label>
                        <input
                          type="number"
                          min={0}
                          value={variant30Stock}
                          onChange={(e) => setVariant30Stock(Number(e.target.value))}
                          className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs text-[#171717]"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] text-[#57534E] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={variant30Active}
                          onChange={(e) => setVariant30Active(e.target.checked)}
                          className="rounded border-[#E8E4DA] text-[#C6A76A]"
                        />
                        <span>Active</span>
                      </label>
                    </div>
                  </div>

                  {/* 50 ml */}
                  <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-3">
                    <div className="flex items-center justify-between font-semibold text-[#171717]">
                      <span>50 ml Spray</span>
                      <span className="text-[#8C6D37]">₹{variant50Price}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="text-[11px] text-[#78716C]">Stock Quantity</label>
                        <input
                          type="number"
                          min={0}
                          value={variant50Stock}
                          onChange={(e) => setVariant50Stock(Number(e.target.value))}
                          className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs text-[#171717]"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] text-[#57534E] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={variant50Active}
                          onChange={(e) => setVariant50Active(e.target.checked)}
                          className="rounded border-[#E8E4DA] text-[#C6A76A]"
                        />
                        <span>Active</span>
                      </label>
                    </div>
                  </div>

                  {/* 100 ml */}
                  <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-3">
                    <div className="flex items-center justify-between font-semibold text-[#171717]">
                      <span>100 ml Spray</span>
                      <span className="text-[#8C6D37]">₹{variant100Price}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="text-[11px] text-[#78716C]">Stock Quantity</label>
                        <input
                          type="number"
                          min={0}
                          value={variant100Stock}
                          onChange={(e) => setVariant100Stock(Number(e.target.value))}
                          className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs text-[#171717]"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] text-[#57534E] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={variant100Active}
                          onChange={(e) => setVariant100Active(e.target.checked)}
                          className="rounded border-[#E8E4DA] text-[#C6A76A]"
                        />
                        <span>Active</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-[#E8E4DA] pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-[#E8E4DA] bg-white px-4 py-2 text-xs font-medium text-[#57534E] hover:bg-[#F8F5EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#292D27] disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-[#C6A76A]" />
                  )}
                  {modalMode === "CREATE" ? "Create Fragrance" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
