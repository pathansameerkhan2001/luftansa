"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ImageIcon,
  Leaf,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import type {
  BottleSizeMl,
  FragranceNoteItem,
  FragranceNotes,
  ProductItem,
  ProductVariantItem,
} from "@/lib/db/schemas";

interface ProductWithVariantList extends ProductItem {
  variants?: ProductVariantItem[];
}

interface ProductManagerProps {
  initialProducts: ProductItem[];
  dbConfigured: boolean;
  initialModalOpen?: boolean;
  initialModalMode?: "CREATE" | "EDIT";
  initialActiveProduct?: ProductItem | null;
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

function resolveAssetUrl(key: string | undefined): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  const cleanKey = key.replace(/^\/+/, "");
  const encoded = cleanKey.split("/").map(encodeURIComponent).join("/");
  return `/media/${encoded}`;
}

export function ProductManager({
  initialProducts,
  dbConfigured,
  initialModalOpen = false,
  initialModalMode = "CREATE",
  initialActiveProduct = null,
}: ProductManagerProps) {
  const [products, setProducts] = useState<ProductWithVariantList[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialModalOpen);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">(initialModalMode);
  const [activeProduct, setActiveProduct] = useState<ProductWithVariantList | null>(initialActiveProduct);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form Basic Fields
  const [formName, setFormName] = useState(initialActiveProduct?.name ?? "");
  const [formId, setFormId] = useState(initialActiveProduct?.id ?? "");
  const [formDescription, setFormDescription] = useState(initialActiveProduct?.description ?? "");
  const [formCategory, setFormCategory] = useState(initialActiveProduct?.category ?? "Perfume");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">(initialActiveProduct?.status ?? "ACTIVE");
  const [formGender, setFormGender] = useState(initialActiveProduct?.gender ?? "Unisex");
  const [formConcentration, setFormConcentration] = useState(initialActiveProduct?.concentration ?? "Eau de Parfum");
  const [formFeatured, setFormFeatured] = useState(initialActiveProduct?.featured ?? false);
  const [formBestseller, setFormBestseller] = useState(initialActiveProduct?.bestseller ?? false);

  // Form Media State (S3)
  const [mainImageKey, setMainImageKey] = useState<string>(
    initialActiveProduct?.mainImageKey || initialActiveProduct?.imageKey || "",
  );
  const [mainImageAlt, setMainImageAlt] = useState<string>(
    initialActiveProduct?.mainImageAlt || initialActiveProduct?.imageAlt || "",
  );
  const [galleryImageKeys, setGalleryImageKeys] = useState<string[]>(
    initialActiveProduct?.galleryImageKeys || [],
  );
  const [mainUploading, setMainUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [noteUploadingId, setNoteUploadingId] = useState<string | null>(null);

  // Form Keywords State
  const [keywords, setKeywords] = useState<string[]>(initialActiveProduct?.keywords || []);
  const [keywordInput, setKeywordInput] = useState("");

  // Form Fragrance Notes (Top, Heart, Base)
  const [notes, setNotes] = useState<FragranceNotes>(
    initialActiveProduct?.notes || {
      top: [],
      heart: [],
      base: [],
    },
  );

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

  // S3 Presigned Upload Helper
  const uploadFileToS3 = async (
    file: File,
    folder: "main" | "gallery" | "notes",
  ): Promise<{ key: string; publicUrl: string }> => {
    const slug = formId.trim() || slugify(formName) || "temp-fragrance";

    // 1. Get presigned upload URL from secure admin route
    const res = await fetch("/api/admin/media/presign-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        folder,
        slug,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to generate upload URL");
    }

    // 2. Upload file directly to S3 via presigned PUT
    const s3Res = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!s3Res.ok) {
      throw new Error(`S3 upload failed (${s3Res.status} ${s3Res.statusText})`);
    }

    return { key: data.key, publicUrl: data.publicUrl };
  };

  // Main Image Upload Handler
  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Please select a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Image file size must be under 10 MB.");
      return;
    }

    setMainUploading(true);
    setErrorMessage(null);
    try {
      const { key } = await uploadFileToS3(file, "main");
      setMainImageKey(key);
      if (!mainImageAlt) {
        setMainImageAlt(`${formName || "Luftansa"} bottle`);
      }
      setSuccessMessage("Main image uploaded to S3.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error uploading main image");
    } finally {
      setMainUploading(false);
      e.target.value = "";
    }
  };

  // Gallery Image Upload Handler
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setGalleryUploading(true);
    setErrorMessage(null);
    try {
      const newKeys: string[] = [];
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) continue;
        if (file.size > 10 * 1024 * 1024) continue;
        const { key } = await uploadFileToS3(file, "gallery");
        newKeys.push(key);
      }
      setGalleryImageKeys((prev) => [...prev, ...newKeys]);
      setSuccessMessage(`Uploaded ${newKeys.length} gallery image(s).`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error uploading gallery image");
    } finally {
      setGalleryUploading(false);
      e.target.value = "";
    }
  };

  // Note Image Upload Handler
  const handleNoteImageUpload = async (
    tier: "top" | "heart" | "base",
    noteId: string,
    file: File,
  ) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Please select a JPEG, PNG or WebP image for the note.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Note image size must be under 10 MB.");
      return;
    }

    setNoteUploadingId(noteId);
    setErrorMessage(null);
    try {
      const { key } = await uploadFileToS3(file, "notes");
      setNotes((prev) => ({
        ...prev,
        [tier]: prev[tier].map((item) => (item.id === noteId ? { ...item, imageKey: key } : item)),
      }));
      setSuccessMessage("Note image uploaded successfully.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error uploading note image");
    } finally {
      setNoteUploadingId(null);
    }
  };

  // Keywords Tag Management
  const addKeyword = () => {
    const cleaned = keywordInput.trim();
    if (!cleaned) return;
    if (!keywords.includes(cleaned)) {
      setKeywords((prev) => [...prev, cleaned]);
    }
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  // Fragrance Notes Management
  const addNoteToTier = (tier: "top" | "heart" | "base") => {
    const newNote: FragranceNoteItem = {
      id: `${tier}-note-${Date.now()}`,
      name: "",
      imageKey: undefined,
      description: "",
    };
    setNotes((prev) => ({
      ...prev,
      [tier]: [...prev[tier], newNote],
    }));
  };

  const updateNoteInTier = (
    tier: "top" | "heart" | "base",
    noteId: string,
    field: "name" | "description",
    value: string,
  ) => {
    setNotes((prev) => ({
      ...prev,
      [tier]: prev[tier].map((n) => (n.id === noteId ? { ...n, [field]: value } : n)),
    }));
  };

  const removeNoteFromTier = (tier: "top" | "heart" | "base", noteId: string) => {
    setNotes((prev) => ({
      ...prev,
      [tier]: prev[tier].filter((n) => n.id !== noteId),
    }));
  };

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

    setMainImageKey("");
    setMainImageAlt("");
    setGalleryImageKeys([]);
    setKeywords([]);
    setKeywordInput("");
    setNotes({ top: [], heart: [], base: [] });

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

    setMainImageKey(product.mainImageKey || product.imageKey || "");
    setMainImageAlt(product.mainImageAlt || product.imageAlt || "");
    setGalleryImageKeys(product.galleryImageKeys || []);
    setKeywords(product.keywords || []);
    setKeywordInput("");
    setNotes(product.notes || { top: [], heart: [], base: [] });

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

    // Clean empty note entries
    const cleanedNotes: FragranceNotes = {
      top: notes.top.filter((n) => n.name.trim() !== ""),
      heart: notes.heart.filter((n) => n.name.trim() !== ""),
      base: notes.base.filter((n) => n.name.trim() !== ""),
    };

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
          mainImageKey: mainImageKey || undefined,
          mainImageAlt: mainImageAlt || undefined,
          galleryImageKeys,
          keywords,
          notes: cleanedNotes,
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
          mainImageKey: mainImageKey || null,
          mainImageAlt: mainImageAlt || null,
          galleryImageKeys,
          keywords,
          notes: cleanedNotes,
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
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.keywords && p.keywords.some((k) => k.toLowerCase().includes(searchTerm.toLowerCase())));
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
            Manage products, S3 photography, bottle variants (30 ml, 50 ml, 100 ml), keywords and fragrance notes.
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

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Total Fragrances</div>
          <div className="mt-2 text-2xl font-bold text-[#171717]">{products.length}</div>
          <div className="mt-1 text-xs text-[#78716C]">In DynamoDB partition</div>
        </div>

        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Active Fragrances</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{totalActive}</div>
          <div className="mt-1 text-xs text-[#78716C]">Visible on storefront</div>
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
            placeholder="Search fragrance by name, slug, category or keywords..."
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
                <th className="px-4 py-3 font-semibold">Category & Keywords</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Variants (30ml / 50ml / 100ml)</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
                <th className="px-4 py-3 font-semibold">Version</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E4DA] text-[#292D27]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Package className="mx-auto h-10 w-10 text-[#C6A76A]/60" />
                    <h3 className="mt-3 font-serif text-base font-semibold text-[#171717]">
                      {products.length === 0 ? "No fragrances in database yet" : "No matching fragrances"}
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-[#78716C]">
                      {products.length === 0
                        ? "Product management foundation is ready on DynamoDB (ap-south-2). Click 'Add First Fragrance' to begin."
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
                filteredProducts.map((p) => {
                  const imageSrc = p.mainImageKey || p.imageKey ? resolveAssetUrl(p.mainImageKey || p.imageKey) : null;
                  const totalNotes = (p.notes?.top?.length ?? 0) + (p.notes?.heart?.length ?? 0) + (p.notes?.base?.length ?? 0);

                  return (
                    <tr key={p.id} className="transition hover:bg-[#FFFDF8]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[#E8E4DA] bg-[#F8F5EC]">
                            {imageSrc ? (
                              <Image src={imageSrc} alt={p.name} fill sizes="40px" className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-brand-gold/60">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-[#171717]">{p.name}</div>
                            <div className="font-mono text-[11px] text-[#78716C]">{p.id}</div>
                            {p.featured && (
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-[#FDF6E8] px-1.5 py-0.2 text-[10px] font-medium text-[#8C6D37]">
                                <Sparkles className="h-2.5 w-2.5" /> Featured
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-[#F8F5EC] px-2 py-0.5 text-[11px] font-medium text-[#57534E]">
                          {p.category}
                        </span>
                        {p.keywords && p.keywords.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.keywords.slice(0, 3).map((kw) => (
                              <span
                                key={kw}
                                className="inline-flex items-center gap-0.5 rounded bg-[#F3EDE2] px-1.5 py-0.2 text-[10px] text-[#786134]"
                              >
                                <Tag className="h-2 w-2" />
                                {kw}
                              </span>
                            ))}
                            {p.keywords.length > 3 && (
                              <span className="text-[10px] text-[#A8A29E]">+{p.keywords.length - 3}</span>
                            )}
                          </div>
                        )}
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
                        <div className="flex items-center gap-1.5">
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
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#FFFDF8] border border-[#E8E4DA] px-2 py-0.5 text-[11px] font-medium text-[#57534E]">
                          <Leaf className="h-3 w-3 text-[#C6A76A]" />
                          {totalNotes} {totalNotes === 1 ? "note" : "notes"}
                        </span>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E8E4DA] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#171717]">
                  {modalMode === "CREATE" ? "Add New Fragrance" : `Edit Fragrance: ${activeProduct?.name}`}
                </h2>
                <p className="mt-0.5 text-xs text-[#78716C]">
                  Configure product details, S3 photography, bottle variants, keywords and independent fragrance notes.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-[#78716C] hover:bg-[#F8F5EC] hover:text-[#171717]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-6">
              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D37]">1. Basic Information</h3>
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
                    placeholder="Fragrance notes, personality, mood and inspiration..."
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
              </div>

              {/* Section 2: Product Photography & S3 Media */}
              <div className="space-y-4 border-t border-[#E8E4DA] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D37]">
                    2. Product Photography (AWS S3)
                  </h3>
                  <span className="text-[11px] text-[#78716C]">Private bucket: luftansa-store-assets</span>
                </div>

                {/* Main Image Upload & Preview */}
                <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#171717]">Main Product Bottle Image</div>
                      <div className="text-[11px] text-[#78716C]">Primary photograph shown on cards and product header</div>
                    </div>
                    {mainImageKey && (
                      <button
                        type="button"
                        onClick={() => setMainImageKey("")}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" /> Remove Main Image
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E8E4DA] bg-[#F8F5EC]">
                      {mainImageKey ? (
                        <Image
                          src={resolveAssetUrl(mainImageKey)}
                          alt={mainImageAlt || "Main product"}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-[#A8A29E]">
                          <ImageIcon className="h-6 w-6 text-[#C6A76A]/60" />
                          <span className="mt-1 text-[10px]">No image</span>
                        </div>
                      )}
                      {mainUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                          <RefreshCw className="h-5 w-5 animate-spin text-[#C6A76A]" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8E4DA] bg-white px-3 py-1.5 text-xs font-medium text-[#292D27] shadow-sm hover:bg-[#F8F5EC]">
                          <Upload className="h-3.5 w-3.5 text-[#C6A76A]" />
                          <span>{mainImageKey ? "Replace Main Image" : "Upload Main Image"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleMainImageUpload}
                            className="hidden"
                            disabled={mainUploading}
                          />
                        </label>
                        {mainImageKey && (
                          <span className="font-mono text-[10px] text-[#78716C] truncate max-w-xs">{mainImageKey}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={mainImageAlt}
                        onChange={(e) => setMainImageAlt(e.target.value)}
                        placeholder="Alt text for main image (e.g. Luftansa Black Velvet bottle)"
                        className="w-full rounded-md border border-[#E8E4DA] bg-white px-2.5 py-1 text-[11px] text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Gallery Images Manager */}
                <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#171717]">Product Gallery Images</div>
                      <div className="text-[11px] text-[#78716C]">Additional photographs for the product gallery carousel</div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8E4DA] bg-white px-3 py-1.5 text-xs font-medium text-[#292D27] shadow-sm hover:bg-[#F8F5EC]">
                      <Upload className="h-3.5 w-3.5 text-[#C6A76A]" />
                      <span>{galleryUploading ? "Uploading..." : "+ Add Gallery Image(s)"}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleGalleryUpload}
                        className="hidden"
                        disabled={galleryUploading}
                      />
                    </label>
                  </div>

                  {galleryImageKeys.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
                      {galleryImageKeys.map((key, idx) => (
                        <div key={key} className="group relative aspect-square overflow-hidden rounded-xl border border-[#E8E4DA] bg-white">
                          <Image
                            src={resolveAssetUrl(key)}
                            alt={`Gallery image ${idx + 1}`}
                            fill
                            sizes="120px"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 flex flex-col justify-between bg-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => {
                                // Swap: gallery item becomes main, current main goes to gallery
                                const oldMain = mainImageKey;
                                setMainImageKey(key);
                                setGalleryImageKeys((prev) =>
                                  prev.filter((k) => k !== key).concat(oldMain ? [oldMain] : []),
                                );
                              }}
                              className="self-end rounded bg-white/90 p-1 text-[10px] font-semibold text-[#171717] hover:bg-white"
                              title="Set as main image"
                            >
                              <Star className="h-3 w-3 text-[#C6A76A]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setGalleryImageKeys((prev) => prev.filter((k) => k !== key))}
                              className="self-end rounded bg-red-600/90 p-1 text-[10px] font-semibold text-white hover:bg-red-700"
                              title="Remove from gallery"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-[#A8A29E] italic">
                      No gallery images uploaded yet. Click &quot;+ Add Gallery Image(s)&quot; to add supplementary shots.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Keywords & Search Tags */}
              <div className="space-y-4 border-t border-[#E8E4DA] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D37]">
                    3. Keywords & Discovery Tags
                  </h3>
                  <span className="text-[11px] text-[#78716C]">Used for search matching and filtering</span>
                </div>

                <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A8A29E]" />
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                        placeholder="Type a keyword (e.g. citrus, evening, woody, amber) and press Enter"
                        className="w-full rounded-lg border border-[#E8E4DA] bg-white py-1.5 pl-8 pr-3 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addKeyword}
                      className="rounded-lg bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#292D27]"
                    >
                      + Add Tag
                    </button>
                  </div>

                  {keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {keywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1 rounded-full border border-[#D4C4A8] bg-[#F8F5EC] px-2.5 py-0.5 text-xs text-[#292D27]"
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() => removeKeyword(kw)}
                            className="rounded-full p-0.5 text-[#78716C] hover:bg-stone-200 hover:text-black"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Fragrance Notes (Top, Heart, Base with Individual Images) */}
              <div className="space-y-4 border-t border-[#E8E4DA] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D37]">
                    4. Fragrance Notes (Top, Heart, Base)
                  </h3>
                  <span className="text-[11px] text-[#78716C]">Each note carries its OWN individual image</span>
                </div>

                {(["top", "heart", "base"] as const).map((tier) => {
                  const title =
                    tier === "top"
                      ? "Top Notes (Opening Impression)"
                      : tier === "heart"
                        ? "Heart Notes (Fragrance Core)"
                        : "Base Notes (Lasting Foundation)";
                  const tierNotes = notes[tier];

                  return (
                    <div key={tier} className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4">
                      <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-2">
                        <div className="flex items-center gap-2">
                          <Leaf className="h-3.5 w-3.5 text-[#C6A76A]" />
                          <h4 className="text-xs font-bold text-[#171717] capitalize">{title}</h4>
                          <span className="text-[10px] text-[#78716C]">({tierNotes.length})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addNoteToTier(tier)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8C6D37] hover:text-[#5E4720]"
                        >
                          <Plus className="h-3 w-3" /> Add {tier.toUpperCase()} Note
                        </button>
                      </div>

                      {tierNotes.length === 0 ? (
                        <div className="py-3 text-center text-[11px] text-[#A8A29E] italic">
                          No {tier} notes added. Click &quot;+ Add {tier.toUpperCase()} Note&quot; to configure.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {tierNotes.map((note) => (
                            <div
                              key={note.id}
                              className="flex flex-col gap-3 rounded-lg border border-[#E8E4DA] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              {/* Individual Note Image Upload/Preview */}
                              <div className="flex items-center gap-3">
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#D4C4A8] bg-[#F8F5EC]">
                                  {note.imageKey ? (
                                    <Image
                                      src={resolveAssetUrl(note.imageKey)}
                                      alt={note.name || "Note image"}
                                      fill
                                      sizes="48px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[#A8A29E]">
                                      <Leaf className="h-5 w-5 text-[#C6A76A]/60" />
                                    </div>
                                  )}
                                  {noteUploadingId === note.id && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                                      <RefreshCw className="h-4 w-4 animate-spin text-[#C6A76A]" />
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium text-[#8C6D37] hover:underline">
                                    <Upload className="h-2.5 w-2.5" />
                                    <span>{note.imageKey ? "Replace Note Image" : "Upload Image"}</span>
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleNoteImageUpload(tier, note.id, file);
                                        e.target.value = "";
                                      }}
                                      className="hidden"
                                      disabled={noteUploadingId === note.id}
                                    />
                                  </label>
                                  {note.imageKey && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNotes((prev) => ({
                                          ...prev,
                                          [tier]: prev[tier].map((item) =>
                                            item.id === note.id ? { ...item, imageKey: undefined } : item,
                                          ),
                                        }));
                                      }}
                                      className="block text-[10px] text-red-600 hover:underline"
                                    >
                                      Remove image
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Note Name & Description */}
                              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                                <input
                                  type="text"
                                  value={note.name}
                                  onChange={(e) => updateNoteInTier(tier, note.id, "name", e.target.value)}
                                  placeholder="Note name (e.g. Citrus, Musk, Amber)"
                                  className="rounded border border-[#E8E4DA] bg-[#FFFDF8] px-2.5 py-1 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={note.description || ""}
                                  onChange={(e) => updateNoteInTier(tier, note.id, "description", e.target.value)}
                                  placeholder="Optional description (e.g. Zesty and crisp)"
                                  className="rounded border border-[#E8E4DA] bg-[#FFFDF8] px-2.5 py-1 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => removeNoteFromTier(tier, note.id)}
                                className="self-end sm:self-center rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                                title="Remove note"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Section 5: Variants Section */}
              <div className="space-y-3 border-t border-[#E8E4DA] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D37]">
                    5. Bottle Variants & Inventory
                  </h3>
                  <span className="text-[11px] text-[#78716C]">Confirmed Standard Prices</span>
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

              {/* Submit & Cancel Buttons */}
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
