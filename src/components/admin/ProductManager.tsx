"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
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
  FragranceNoteItem,
  FragranceNotes,
  ProductItem,
  ProductVariantItem,
  StorefrontCollection,
  VerifiableField,
} from "@/lib/db/schemas";
import { MAX_NOTES_PER_GROUP } from "@/lib/db/schemas";
import { DEFAULT_ROLL_ON_SIZE_ML, FORMAT_LABEL, PERFUME_TYPE_ID, perfumesWithRollOnSizes, productFormat, productIdFor, ROLL_ON_TYPE_ID, SECTION_LABEL, type ProductFormat } from "@/lib/catalogue/product-format";
import { compressImageForUpload } from "@/lib/media/compress-image";
import { formatMegabytes, isAllowedImageType, MAX_SOURCE_BYTES } from "@/lib/media/upload-limits";

interface ProductWithVariantList extends ProductItem {
  variants?: ProductVariantItem[];
}

type VariantUnit = "ml" | "g" | "pieces" | "units" | "oz";

interface VariantFormRow {
  id: string;
  capacity: number;
  unit: VariantUnit;
  label: string;
  priceInr: number;
  mrpInr?: number;
  /** null = stock not configured ("Not set"); 0 = genuine zero stock. */
  stockQuantity: number | null;
  /** Empty = no SKU assigned ("Not set"). SKUs are never auto-generated. */
  sku: string;
  status: "ACTIVE" | "INACTIVE";
}

const COLLECTION_OPTIONS: { id: StorefrontCollection; label: string }[] = [
  { id: "signature", label: "Signature Collection" },
  { id: "personality", label: "Personality Collection" },
];

const UNVERIFIED_LABEL: Record<VerifiableField, string> = {
  description: "Description",
  notes: "Fragrance notes",
};

interface ProductManagerProps {
  initialProducts: ProductWithVariantList[];
  initialError?: string | null;
  dbConfigured: boolean;
  initialModalOpen?: boolean;
  initialModalMode?: "CREATE" | "EDIT";
  initialActiveProduct?: ProductItem | null;
}

/** Confirmed standard prices, used only to pre-fill new standard-size variants. */
const STANDARD_PRICES: Record<number, number> = {
  30: 400,
  50: 630,
  100: 1000,
};

function standardPrice(capacity: number, unit: VariantUnit): number | undefined {
  return unit === "ml" ? STANDARD_PRICES[capacity] : undefined;
}

function toVariantRows(variants: ProductVariantItem[]): VariantFormRow[] {
  return variants
    .filter((v) => v.status !== "ARCHIVED")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((v, i) => ({
      id: v.id || v.sk.replace("VARIANT#", "") || `v_${i}`,
      capacity: v.capacity ?? v.sizeMl ?? 30,
      unit: (v.unit as VariantUnit) || "ml",
      label: v.label || `${v.capacity ?? v.sizeMl} ${v.unit || "ml"}`,
      priceInr: v.priceInr,
      mrpInr: v.mrpInr,
      stockQuantity: v.stockQuantity ?? null,
      sku: v.sku ?? "",
      status: (v.status === "ACTIVE" ? "ACTIVE" : "INACTIVE") as "ACTIVE" | "INACTIVE",
    }));
}

/** Default variants for a new product: Perfume sprays 30/50/100 ml (standard prices); a Roll-On one 8 ml size (price to be entered). */
function defaultVariantRows(productTypeId: string = PERFUME_TYPE_ID): VariantFormRow[] {
  const stamp = Date.now().toString(36);
  if (productFormat(productTypeId) === "roll-on") {
    return [{ id: `v_${stamp}_1`, capacity: DEFAULT_ROLL_ON_SIZE_ML, unit: "ml", label: `${DEFAULT_ROLL_ON_SIZE_ML} ml`, priceInr: 0, stockQuantity: null, sku: "", status: "ACTIVE" }];
  }
  return [30, 50, 100].map((ml, i) => ({
    id: `v_${stamp}_${i + 1}`,
    capacity: ml,
    unit: "ml" as const,
    label: `${ml} ml`,
    priceInr: STANDARD_PRICES[ml],
    stockQuantity: null,
    sku: "",
    status: "ACTIVE" as const,
  }));
}

/** Reads an error message from an API response that may not be JSON (e.g. a platform 413). */
async function readApiError(res: Response, fallback: string): Promise<string> {
  if (res.status === 413) return "The image is too large to upload. Please choose a smaller image.";
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || fallback;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

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
  initialError = null,
  dbConfigured,
  initialModalOpen = false,
  initialModalMode = "CREATE",
  initialActiveProduct = null,
}: ProductManagerProps) {
  const [products, setProducts] = useState<ProductWithVariantList[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  /** Product section shown in the list: Perfumes, Roll-On, other types, or everything. */
  const [sectionFilter, setSectionFilter] = useState<"all" | ProductFormat>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
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
  const [formProductTypeId, setFormProductTypeId] = useState(initialActiveProduct?.productTypeId ?? "perfume-spray");
  const [formCategory, setFormCategory] = useState(initialActiveProduct?.category ?? "Perfume Spray");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">(initialActiveProduct?.status ?? "ACTIVE");
  const [notesEnabled, setNotesEnabled] = useState<boolean>(initialActiveProduct?.notesEnabled ?? true);
  // Empty = not set. Never pre-filled with assumed values.
  const [formGender, setFormGender] = useState(initialActiveProduct?.gender ?? "");
  const [formConcentration, setFormConcentration] = useState(initialActiveProduct?.concentration ?? "");
  const [formFeatured, setFormFeatured] = useState(initialActiveProduct?.featured ?? false);
  const [formBestseller, setFormBestseller] = useState(initialActiveProduct?.bestseller ?? false);
  const [formCollections, setFormCollections] = useState<StorefrontCollection[]>(initialActiveProduct?.collections ?? []);
  const [formDisplayOrder, setFormDisplayOrder] = useState<string>(
    initialActiveProduct?.displayOrder !== undefined ? String(initialActiveProduct.displayOrder) : "",
  );
  const [unverifiedFields, setUnverifiedFields] = useState<VerifiableField[]>(initialActiveProduct?.unverifiedFields ?? []);

  // Product Types State
  const [productTypes, setProductTypes] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    defaultUnit: "ml" | "g" | "pieces" | "units" | "oz";
    hasNotes: boolean;
    status: "ACTIVE" | "INACTIVE";
  }>>([
    { id: "perfume-spray", name: "Perfume Spray", defaultUnit: "ml", hasNotes: true, status: "ACTIVE" },
    { id: "roll-on", name: "Roll-On", defaultUnit: "ml", hasNotes: true, status: "ACTIVE" },
    { id: "air-freshener", name: "Air Freshener", defaultUnit: "ml", hasNotes: false, status: "ACTIVE" },
    { id: "attar", name: "Attar", defaultUnit: "ml", hasNotes: true, status: "ACTIVE" },
  ]);

  // New Product Type Modal
  const [isNewTypeModalOpen, setIsNewTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeUnit, setNewTypeUnit] = useState<"ml" | "g" | "pieces" | "units" | "oz">("ml");
  const [newTypeHasNotes, setNewTypeHasNotes] = useState(true);
  const [newTypeSubmitting, setNewTypeSubmitting] = useState(false);

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

  // Dynamic Variants Form State (Stable unique IDs, capacity, unit, price, stock, SKU)
  const [variantsList, setVariantsList] = useState<VariantFormRow[]>(defaultVariantRows);

  // Load product types on mount
  useEffect(() => {
    fetch("/api/admin/product-types")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
          setProductTypes(data.items);
        }
      })
      .catch(() => {});
  }, []);

  /**
   * Uploads an image to private S3 through the same-origin admin API.
   * Images above the upload limit are compressed in the browser first.
   * (The presigned direct-to-S3 path is not used: the bucket has no CORS rule.)
   */
  const uploadFileToS3 = async (
    file: File,
    folder: "main" | "gallery" | "notes",
  ): Promise<{ key: string; publicUrl: string }> => {
    if (!isAllowedImageType(file.type)) {
      throw new Error(`"${file.name}" is not a JPEG, PNG or WebP image.`);
    }
    if (file.size > MAX_SOURCE_BYTES) {
      throw new Error(`"${file.name}" is ${formatMegabytes(file.size)}; please choose an image under ${formatMegabytes(MAX_SOURCE_BYTES)}.`);
    }
    const slug = formId.trim() || slugify(formName) || "temp-fragrance";
    const prepared = await compressImageForUpload(file);

    const formData = new FormData();
    formData.append("file", prepared);
    formData.append("folder", folder);
    formData.append("slug", slug);

    let res: Response;
    try {
      res = await fetch("/api/admin/media/upload", { method: "POST", body: formData });
    } catch {
      throw new Error(`Could not reach the upload service for "${file.name}". Check your connection and try again.`);
    }
    if (!res.ok) {
      throw new Error(`Upload of "${file.name}" failed: ${await readApiError(res, "upload failed")}`);
    }
    const data = (await res.json()) as { key?: string; publicUrl?: string };
    if (!data.key) throw new Error(`Upload of "${file.name}" failed: no storage key returned.`);
    return { key: data.key, publicUrl: data.publicUrl ?? "" };
  };

  // Main Image Upload Handler
  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedImageType(file.type)) {
      setErrorMessage("Please select a JPEG, PNG or WebP image.");
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
      setSuccessMessage("Main image uploaded. Save the product to keep it.");
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
      const failures: string[] = [];
      const capacity = Math.max(0, 8 - galleryImageKeys.length);
      if (files.length > capacity) {
        failures.push(`Only ${capacity} more gallery image(s) can be added (maximum 8).`);
      }
      for (const file of files.slice(0, capacity)) {
        try {
          const { key } = await uploadFileToS3(file, "gallery");
          newKeys.push(key);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : `Upload of "${file.name}" failed.`);
        }
      }
      if (newKeys.length > 0) {
        setGalleryImageKeys((prev) => [...prev, ...newKeys]);
        setSuccessMessage(`Uploaded ${newKeys.length} gallery image(s). Save the product to keep them.`);
      }
      if (failures.length > 0) setErrorMessage(failures.join(" "));
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
    if (!isAllowedImageType(file.type)) {
      setErrorMessage("Please select a JPEG, PNG or WebP image for the note.");
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
    if (notes[tier].length >= MAX_NOTES_PER_GROUP) return;
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
      const res = await fetch("/api/admin/products?include=variants", {
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

  const openCreateModal = (typeId: string = PERFUME_TYPE_ID) => {
    setModalMode("CREATE");
    setActiveProduct(null);
    setFormName("");
    setFormId("");
    setFormDescription("");
    const defaultType = productTypes.find((t) => t.id === typeId) || productTypes[0] || { id: PERFUME_TYPE_ID, name: "Perfume Spray", defaultUnit: "ml", hasNotes: true };
    setFormProductTypeId(defaultType.id);
    setFormCategory(defaultType.name);
    setNotesEnabled(defaultType.hasNotes);
    setFormStatus("ACTIVE");
    setFormGender("");
    setFormConcentration("");
    setFormFeatured(false);
    setFormBestseller(false);
    setFormCollections([]);
    setFormDisplayOrder("");
    setUnverifiedFields([]);

    setMainImageKey("");
    setMainImageAlt("");
    setGalleryImageKeys([]);
    setKeywords([]);
    setKeywordInput("");
    setNotes({ top: [], heart: [], base: [] });

    setVariantsList(defaultVariantRows(defaultType.id));

    setIsModalOpen(true);
    setErrorMessage(null);
  };

  const openEditModal = async (product: ProductWithVariantList) => {
    setModalMode("EDIT");
    setActiveProduct(product);
    setFormName(product.name);
    setFormId(product.id);
    setFormDescription(product.description || "");
    setFormProductTypeId(product.productTypeId || "perfume-spray");
    setFormCategory(product.category || "Perfume Spray");
    setFormStatus(product.status);
    setNotesEnabled(product.notesEnabled ?? true);
    setFormGender(product.gender || "");
    setFormConcentration(product.concentration || "");
    setFormFeatured(product.featured || false);
    setFormBestseller(product.bestseller || false);
    setFormCollections(product.collections ?? []);
    setFormDisplayOrder(product.displayOrder !== undefined ? String(product.displayOrder) : "");
    setUnverifiedFields(product.unverifiedFields ?? []);
    if (product.variants && product.variants.length > 0) {
      setVariantsList(toVariantRows(product.variants));
    }

    setMainImageKey(product.mainImageKey || product.imageKey || "");
    setMainImageAlt(product.mainImageAlt || product.imageAlt || "");
    setGalleryImageKeys(product.galleryImageKeys || []);
    setKeywords(product.keywords || []);
    setKeywordInput("");
    setNotes(product.notes || { top: [], heart: [], base: [] });

    // Fetch fresh product data and variants directly from base table
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`);
      const data = await res.json();
      if (res.ok) {
        if (data.product) {
          const fresh = data.product as ProductItem;
          setActiveProduct(fresh);
          setFormName(fresh.name);
          setFormDescription(fresh.description || "");
          setFormProductTypeId(fresh.productTypeId || "perfume-spray");
          setFormCategory(fresh.category || "Perfume Spray");
          setFormStatus(fresh.status);
          setNotesEnabled(fresh.notesEnabled ?? true);
          setFormGender(fresh.gender || "");
          setFormConcentration(fresh.concentration || "");
          setFormFeatured(fresh.featured || false);
          setFormBestseller(fresh.bestseller || false);
          setFormCollections(fresh.collections ?? []);
          setFormDisplayOrder(fresh.displayOrder !== undefined ? String(fresh.displayOrder) : "");
          setUnverifiedFields(fresh.unverifiedFields ?? []);

          setMainImageKey(fresh.mainImageKey || fresh.imageKey || "");
          setMainImageAlt(fresh.mainImageAlt || fresh.imageAlt || "");
          setGalleryImageKeys(fresh.galleryImageKeys || []);
          setKeywords(fresh.keywords || []);
          setNotes(fresh.notes || { top: [], heart: [], base: [] });
        }
        if (data.variants && Array.isArray(data.variants)) {
          const rows = toVariantRows(data.variants as ProductVariantItem[]);
          if (rows.length > 0) setVariantsList(rows);
        }
      } else {
        setErrorMessage(data.message || data.error || "Could not load the latest product data.");
      }
    } catch {
      // Keep initial variants
    }

    setIsModalOpen(true);
    setErrorMessage(null);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (modalMode === "CREATE") {
      // A Roll-On gets its own web address ("black-velvet-roll-on"), separate from the Perfume.
      setFormId(productIdFor(slugify(val), formProductTypeId));
    }
  };

  const addVariantRow = () => {
    const selectedType = productTypes.find((t) => t.id === formProductTypeId);
    const unit = (selectedType?.defaultUnit as VariantUnit) || "ml";
    const capacity = unit === "ml" ? 50 : 1;
    const newVariant: VariantFormRow = {
      id: `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      capacity,
      unit,
      label: `${capacity} ${unit}`,
      // Pre-filled only for confirmed standard sizes; otherwise the admin must enter a price.
      priceInr: standardPrice(capacity, unit) ?? 0,
      stockQuantity: null,
      sku: "",
      status: "ACTIVE",
    };
    setVariantsList((prev) => [...prev, newVariant]);
  };

  const updateVariantRow = (id: string, field: keyof VariantFormRow, value: string | number | boolean | null) => {
    setVariantsList((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const updated = { ...v, [field]: value } as VariantFormRow;
        if (field === "capacity" || field === "unit") {
          updated.label = `${updated.capacity} ${updated.unit}`;
        }
        return updated;
      }),
    );
  };

  const toggleCollection = (id: StorefrontCollection, checked: boolean) => {
    setFormCollections((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((c) => c !== id)));
  };

  const markVerified = (field: VerifiableField) => {
    setUnverifiedFields((prev) => prev.filter((f) => f !== field));
  };

  const removeVariantRow = (id: string) => {
    if (variantsList.length <= 1) {
      setErrorMessage("A product must have at least one variant.");
      return;
    }
    setVariantsList((prev) => prev.filter((v) => v.id !== id));
  };

  const handleCreateProductType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    setNewTypeSubmitting(true);
    try {
      const typeId = slugify(newTypeName);
      const res = await fetch("/api/admin/product-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: typeId,
          name: newTypeName.trim(),
          defaultUnit: newTypeUnit,
          hasNotes: newTypeHasNotes,
          status: "ACTIVE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to create product type");

      setProductTypes((prev) => [...prev, data.item]);
      setFormProductTypeId(data.item.id);
      setFormCategory(data.item.name);
      setNotesEnabled(data.item.hasNotes);
      setIsNewTypeModalOpen(false);
      setNewTypeName("");
      setSuccessMessage(`Product type "${data.item.name}" created.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error creating product type");
    } finally {
      setNewTypeSubmitting(false);
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

    // Never submit invented prices: every variant needs an explicit positive price.
    const missingPrice = variantsList.find((v) => !Number.isInteger(Number(v.priceInr)) || Number(v.priceInr) < 1);
    if (missingPrice) {
      setErrorMessage(`Please enter a price for the ${missingPrice.label || `${missingPrice.capacity} ${missingPrice.unit}`} variant.`);
      setSubmitting(false);
      return;
    }
    const displayOrderValue = formDisplayOrder.trim() === "" ? null : Number(formDisplayOrder);
    if (displayOrderValue !== null && (!Number.isInteger(displayOrderValue) || displayOrderValue < 0)) {
      setErrorMessage("Display order must be a whole number (0 or more), or left empty.");
      setSubmitting(false);
      return;
    }
    const isCreate = modalMode === "CREATE";

    const variantsPayload = variantsList.map((v, idx) => ({
      id: v.id,
      capacity: Number(v.capacity) || 1,
      unit: v.unit,
      label: v.label || `${v.capacity} ${v.unit}`,
      priceInr: Number(v.priceInr),
      mrpInr: v.mrpInr ? Number(v.mrpInr) : undefined,
      // Unset values: omitted on create, explicitly cleared (null) on update.
      stockQuantity: v.stockQuantity === null ? (isCreate ? undefined : null) : Math.max(0, Math.trunc(v.stockQuantity)),
      sku: v.sku.trim() ? v.sku.trim() : isCreate ? undefined : null,
      status: v.status,
      sortOrder: idx,
    }));

    try {
      if (modalMode === "CREATE") {
        const payload = {
          id: formId.trim(),
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          productTypeId: formProductTypeId,
          productTypeName: formCategory,
          category: formCategory.trim() || "Perfume",
          status: formStatus,
          notesEnabled,
          sizes: variantsList.map((v) => v.capacity),
          mainImageKey: mainImageKey || undefined,
          mainImageAlt: mainImageAlt || undefined,
          galleryImageKeys,
          keywords,
          notes: cleanedNotes,
          gender: formGender || undefined,
          concentration: formConcentration.trim() || undefined,
          featured: formFeatured,
          bestseller: formBestseller,
          collections: formCollections,
          displayOrder: displayOrderValue ?? undefined,
          unverifiedFields,
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
          productTypeId: formProductTypeId,
          productTypeName: formCategory,
          category: formCategory.trim() || "Perfume",
          status: formStatus,
          notesEnabled,
          sizes: variantsList.map((v) => v.capacity),
          mainImageKey: mainImageKey || null,
          mainImageAlt: mainImageAlt || null,
          galleryImageKeys,
          keywords,
          notes: cleanedNotes,
          gender: formGender || null,
          concentration: formConcentration.trim() || null,
          featured: formFeatured,
          bestseller: formBestseller,
          collections: formCollections,
          displayOrder: displayOrderValue,
          unverifiedFields,
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
    const matchesSection = sectionFilter === "all" || productFormat(p.productTypeId) === sectionFilter;
    return matchesSearch && matchesStatus && matchesSection;
  });

  const countBy = (f: ProductFormat, activeOnly = false) =>
    products.filter((p) => productFormat(p.productTypeId) === f && (!activeOnly || p.status === "ACTIVE")).length;
  const sectionTabs: { id: "all" | ProductFormat; label: string; count: number }[] = [
    { id: "perfume", label: SECTION_LABEL.perfume, count: countBy("perfume") },
    { id: "roll-on", label: SECTION_LABEL["roll-on"], count: countBy("roll-on") },
    ...(countBy("other") > 0 ? [{ id: "other" as const, label: SECTION_LABEL.other, count: countBy("other") }] : []),
    { id: "all", label: "All", count: products.length },
  ];

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
            Perfumes (spray sizes 30 ml, 50 ml, 100 ml) and Roll-Ons (8 ml) are separate products, each with its own photos, prices, SKUs, stock and status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refreshProducts}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E4DA] bg-white px-3 py-2 text-xs font-medium text-[#292D27] shadow-sm transition hover:bg-[#F8F5EC] disabled:opacity-50"
            title="Refresh product list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/admin/products/import"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E4DA] bg-white px-3 py-2 text-xs font-medium text-[#292D27] shadow-sm transition hover:bg-[#F8F5EC]"
            data-action="import-excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#8C6D37]" />
            Import Excel
          </Link>
          <button
            onClick={() => openCreateModal(ROLL_ON_TYPE_ID)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#171717] bg-white px-3 py-2 text-xs font-semibold text-[#171717] shadow-sm transition hover:bg-[#F8F5EC]"
            data-action="new-roll-on"
          >
            <Plus className="h-4 w-4 text-[#8C6D37]" />
            New Roll-On
          </button>
          <button
            onClick={() => openCreateModal(PERFUME_TYPE_ID)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-[#292D27]"
            data-action="new-perfume"
          >
            <Plus className="h-4 w-4 text-[#C6A76A]" />
            New Perfume
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
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Perfumes</div>
          <div className="mt-2 text-2xl font-bold text-[#171717]">{countBy("perfume")}</div>
          <div className="mt-1 text-xs text-[#78716C]">{countBy("perfume", true)} visible on storefront</div>
        </div>

        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Roll-On</div>
          <div className="mt-2 text-2xl font-bold text-[#171717]">{countBy("roll-on")}</div>
          <div className="mt-1 text-xs text-[#78716C]">{countBy("roll-on", true)} visible on storefront</div>
        </div>

        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Confirmed Sizes</div>
          <div className="mt-2 text-sm font-semibold text-[#171717]">30 ml • 50 ml • 100 ml</div>
          <div className="mt-1 text-xs text-[#78716C]">Perfume sprays · Roll-On {DEFAULT_ROLL_ON_SIZE_ML} ml</div>
        </div>

        <div className="rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[#78716C]">Standard Pricing</div>
          <div className="mt-2 text-sm font-semibold text-[#8C6D37]">₹400 • ₹630 • ₹1,000</div>
          <div className="mt-1 text-xs text-[#78716C]">Perfume spray standard rates</div>
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

      {/* Migration check (read-only): Roll-On sizes still stored inside a Perfume. */}
      {perfumesWithRollOnSizes(products).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-rollon-migration>
          <div className="font-semibold">Roll-On sizes found inside Perfume products</div>
          <p className="mt-1 text-xs text-amber-800">
            Roll-Ons are now separate products. These Perfumes still list a Roll-On size, so the Roll-On is shown on the Perfume page:
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {perfumesWithRollOnSizes(products).map((p) => (
              <li key={p.id}>
                {p.name} ({p.id}): {p.sizes.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            To fix one: create the Roll-On with &ldquo;New Roll-On&rdquo; (or import it), then edit the Perfume and remove its Roll-On size. Nothing is changed automatically.
          </p>
        </div>
      )}

      {/* Product sections: Perfumes and Roll-On are managed separately */}
      <div role="tablist" aria-label="Product sections" className="flex flex-wrap gap-2" data-product-sections>
        {sectionTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={sectionFilter === t.id}
            onClick={() => setSectionFilter(t.id)}
            data-section-tab={t.id}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              sectionFilter === t.id ? "border-[#171717] bg-[#171717] text-[#E9D6AB]" : "border-[#E8E4DA] bg-white text-[#57534E] hover:bg-[#F8F5EC]"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[10.5px] ${sectionFilter === t.id ? "bg-white/15" : "bg-[#F3EDE2] text-[#8C6D37]"}`}>{t.count}</span>
          </button>
        ))}
      </div>

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
                <th className="px-4 py-3 font-semibold">Sizes & prices</th>
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
                        onClick={() => openCreateModal(PERFUME_TYPE_ID)}
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
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-[#171717]">{p.name}</span>
                              <span
                                className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
                                  productFormat(p.productTypeId) === "roll-on"
                                    ? "bg-[#EEF2F7] text-[#3B4A63]"
                                    : productFormat(p.productTypeId) === "perfume"
                                      ? "bg-[#F3EDE2] text-[#8C6D37]"
                                      : "bg-[#F1F1EF] text-[#57534E]"
                                }`}
                                data-product-format={productFormat(p.productTypeId)}
                              >
                                {productFormat(p.productTypeId) === "other" ? p.productTypeName || "Other" : FORMAT_LABEL[productFormat(p.productTypeId)]}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-[#78716C]">{p.id}</div>
                            {(p.unverifiedFields?.length ?? 0) > 0 && (
                              <span
                                className="mt-0.5 mr-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-800"
                                title={`Unverified: ${(p.unverifiedFields ?? []).map((f) => UNVERIFIED_LABEL[f]).join(", ")}`}
                              >
                                <AlertCircle className="h-2.5 w-2.5" /> Unverified content
                              </span>
                            )}
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
                        <VariantSummary variants={p.variants} />
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-[#292D27]">Description</label>
                    {unverifiedFields.includes("description") && (
                      <UnverifiedBadge onVerify={() => markVerified("description")} />
                    )}
                  </div>
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
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#292D27]">Product Type *</label>
                      <button
                        type="button"
                        onClick={() => setIsNewTypeModalOpen(true)}
                        className="text-[11px] font-medium text-[#8C6D37] hover:underline inline-flex items-center gap-0.5"
                      >
                        <Plus className="size-3" />
                        <span>Add Type</span>
                      </button>
                    </div>
                    <select
                      value={formProductTypeId}
                      onChange={(e) => {
                        const typeId = e.target.value;
                        const previousTypeId = formProductTypeId;
                        setFormProductTypeId(typeId);
                        const selected = productTypes.find((t) => t.id === typeId);
                        if (selected) {
                          setFormCategory(selected.name);
                          setNotesEnabled(selected.hasNotes);
                        }
                        if (modalMode === "CREATE") {
                          // Keep Perfume and Roll-On separate: a new product takes its type's sizes and web address.
                          if (productFormat(previousTypeId) !== productFormat(typeId)) setVariantsList(defaultVariantRows(typeId));
                          if (formName.trim()) setFormId(productIdFor(slugify(formName), typeId));
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                    >
                      {productTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.defaultUnit}){t.status === "INACTIVE" ? " [Inactive]" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#292D27]">Gender</label>
                    <select
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                    >
                      <option value="">Not set</option>
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
                      placeholder="Not set (e.g. Eau de Parfum)"
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

                <div className="rounded-lg border border-[#E8E4DA] bg-[#FFFDF8] p-3 text-xs">
                  <div className="text-[11px] font-semibold text-[#292D27]">Homepage placement</div>
                  <p className="mt-0.5 text-[11px] text-[#78716C]">
                    Best Sellers shows products marked &quot;Bestseller&quot;. The Personality Collection lists its members first,
                    followed by every other active product. Lower display order appears first.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-5">
                    {COLLECTION_OPTIONS.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formCollections.includes(c.id)}
                          onChange={(e) => toggleCollection(c.id, e.target.checked)}
                          className="rounded border-[#E8E4DA] text-[#C6A76A] focus:ring-[#C6A76A]"
                        />
                        <span className="font-medium text-[#292D27]">{c.label}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2">
                      <span className="font-medium text-[#292D27]">Display order</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={formDisplayOrder}
                        placeholder="Not set"
                        onChange={(e) => setFormDisplayOrder(e.target.value)}
                        className="w-24 rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs text-[#171717] placeholder:italic placeholder:text-[#A8A29E]"
                      />
                    </label>
                  </div>
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
                        <label
                          htmlFor="main-product-file-input"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8E4DA] bg-white px-3 py-1.5 text-xs font-medium text-[#292D27] shadow-sm hover:bg-[#F8F5EC]"
                        >
                          <Upload className="h-3.5 w-3.5 text-[#C6A76A]" />
                          <span>{mainImageKey ? "Replace Main Image" : "Upload Main Image"}</span>
                        </label>
                        <input
                          id="main-product-file-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleMainImageUpload}
                          className="sr-only"
                          disabled={mainUploading}
                        />
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
                    <div>
                      <label
                        htmlFor="gallery-product-file-input"
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8E4DA] bg-white px-3 py-1.5 text-xs font-medium text-[#292D27] shadow-sm hover:bg-[#F8F5EC]"
                      >
                        <Upload className="h-3.5 w-3.5 text-[#C6A76A]" />
                        <span>{galleryUploading ? "Uploading..." : "+ Add Gallery Image(s)"}</span>
                      </label>
                      <input
                        id="gallery-product-file-input"
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleGalleryUpload}
                        className="sr-only"
                        disabled={galleryUploading}
                      />
                    </div>
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D37]">
                      4. Fragrance Notes Pyramid
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-[#57534E] cursor-pointer rounded border border-[#E8E4DA] bg-white px-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={notesEnabled}
                        onChange={(e) => setNotesEnabled(e.target.checked)}
                        className="rounded border-[#E8E4DA] text-[#C6A76A]"
                      />
                      <span>Enable Notes</span>
                    </label>
                    {unverifiedFields.includes("notes") && (
                      <UnverifiedBadge onVerify={() => markVerified("notes")} />
                    )}
                  </div>
                  <span className="text-[11px] text-[#78716C]">Each note carries its OWN individual image</span>
                </div>

                {!notesEnabled ? (
                  <div className="rounded-xl border border-dashed border-[#E8E4DA] bg-[#FFFDF8] p-4 text-center text-xs text-[#78716C]">
                    Fragrance notes are disabled for this product. Check &quot;Enable Notes&quot; above to configure Top, Heart and Base notes.
                  </div>
                ) : (
                  (["top", "heart", "base"] as const).map((tier) => {
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
                          disabled={tierNotes.length >= MAX_NOTES_PER_GROUP}
                          title={tierNotes.length >= MAX_NOTES_PER_GROUP ? `At most ${MAX_NOTES_PER_GROUP} notes per group` : undefined}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8C6D37] hover:text-[#5E4720] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" /> Add {tier.toUpperCase()} Note
                          <span className="font-normal text-[#A8A29E]">
                            ({tierNotes.length}/{MAX_NOTES_PER_GROUP})
                          </span>
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
                                  <label
                                    htmlFor={`note-file-${note.id}`}
                                    className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium text-[#8C6D37] hover:underline"
                                  >
                                    <Upload className="h-2.5 w-2.5" />
                                    <span>{note.imageKey ? "Replace Note Image" : "Upload Image"}</span>
                                  </label>
                                  <input
                                    id={`note-file-${note.id}`}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleNoteImageUpload(tier, note.id, file);
                                      e.target.value = "";
                                    }}
                                    className="sr-only"
                                    disabled={noteUploadingId === note.id}
                                  />
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
                }))}
              </div>

              {/* Section 5: Dynamic Variants & Inventory */}
              <div className="space-y-3 border-t border-[#E8E4DA] pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D37]">
                      5. Variants, Capacities & Inventory
                    </h3>
                    <p className="text-[11px] text-[#78716C]">
                      Manage custom capacities, units (ml, g, pieces), prices and stock.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#C6A76A] bg-[#FFFDF8] px-2.5 py-1 text-xs font-semibold text-[#8C6D37] hover:bg-[#F5F0E6] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Variant</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {variantsList.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex flex-col gap-2 rounded-xl border border-[#E8E4DA] bg-[#FFFDF8] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
                        {/* Capacity */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-[#78716C]">Capacity / Size</label>
                          <input
                            type="number"
                            min={0.1}
                            step="any"
                            value={variant.capacity}
                            onChange={(e) => updateVariantRow(variant.id, "capacity", Number(e.target.value))}
                            className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs font-semibold text-[#171717]"
                          />
                        </div>

                        {/* Unit */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-[#78716C]">Unit</label>
                          <select
                            value={variant.unit}
                            onChange={(e) => updateVariantRow(variant.id, "unit", e.target.value)}
                            className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs text-[#171717]"
                          >
                            <option value="ml">ml</option>
                            <option value="g">g</option>
                            <option value="pieces">pieces</option>
                            <option value="units">units</option>
                            <option value="oz">oz</option>
                          </select>
                        </div>

                        {/* Price INR */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-[#78716C]">Price (₹)</label>
                          <input
                            type="number"
                            min={1}
                            value={variant.priceInr > 0 ? variant.priceInr : ""}
                            placeholder="Required"
                            onChange={(e) => updateVariantRow(variant.id, "priceInr", e.target.value === "" ? 0 : Number(e.target.value))}
                            className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs font-semibold text-[#8C6D37]"
                          />
                        </div>

                        {/* Stock */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-[#78716C]">Stock Qty</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={variant.stockQuantity ?? ""}
                            placeholder="Not set"
                            title="Leave empty when stock has not been configured. 0 means out of stock."
                            onChange={(e) =>
                              updateVariantRow(
                                variant.id,
                                "stockQuantity",
                                e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))),
                              )
                            }
                            className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 text-xs text-[#171717] placeholder:italic placeholder:text-[#A8A29E]"
                          />
                        </div>

                        {/* SKU */}
                        <div className="col-span-2 sm:col-span-1">
                          <label className="text-[10px] uppercase font-bold text-[#78716C]">SKU Code</label>
                          <input
                            type="text"
                            value={variant.sku}
                            placeholder="Not set"
                            maxLength={64}
                            onChange={(e) => updateVariantRow(variant.id, "sku", e.target.value)}
                            className="mt-0.5 w-full rounded border border-[#E8E4DA] bg-white px-2 py-1 font-mono text-[11px] text-[#171717] placeholder:font-sans placeholder:italic placeholder:text-[#A8A29E]"
                          />
                        </div>
                      </div>

                      {/* Status Toggle & Remove */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-[#E8E4DA] sm:border-0 pt-2 sm:pt-0">
                        <label className="flex items-center gap-1 text-[11px] text-[#57534E] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={variant.status === "ACTIVE"}
                            onChange={(e) => updateVariantRow(variant.id, "status", e.target.checked ? "ACTIVE" : "INACTIVE")}
                            className="rounded border-[#E8E4DA] text-[#C6A76A]"
                          />
                          <span>Active</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeVariantRow(variant.id)}
                          disabled={variantsList.length <= 1}
                          className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={variantsList.length <= 1 ? "At least one variant required" : "Remove variant (will be safely archived on save)"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
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
      {/* Modal: Add New Product Type */}
      {isNewTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E8E4DA] bg-[#FFFDF8] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8E4DA] pb-3">
              <h3 className="font-serif text-lg font-bold text-[#171717]">Add New Product Type</h3>
              <button
                type="button"
                onClick={() => setIsNewTypeModalOpen(false)}
                className="rounded-full p-1 text-[#78716C] hover:bg-stone-200 hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProductType} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717]">Type Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Car Diffuser, Wax Melt, Body Mist"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#C6A76A] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#171717]">Default Unit</label>
                  <select
                    value={newTypeUnit}
                    onChange={(e) => setNewTypeUnit(e.target.value as "ml" | "g" | "pieces" | "units" | "oz")}
                    className="mt-1 w-full rounded-lg border border-[#E8E4DA] bg-white px-3 py-2 text-xs text-[#171717]"
                  >
                    <option value="ml">ml (Milliliters)</option>
                    <option value="g">g (Grams)</option>
                    <option value="pieces">pieces</option>
                    <option value="units">units</option>
                    <option value="oz">oz (Ounces)</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-1.5 text-xs text-[#57534E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTypeHasNotes}
                      onChange={(e) => setNewTypeHasNotes(e.target.checked)}
                      className="rounded border-[#E8E4DA] text-[#C6A76A]"
                    />
                    <span>Has Fragrance Notes</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#E8E4DA] pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewTypeModalOpen(false)}
                  className="rounded-lg border border-[#E8E4DA] px-3 py-1.5 text-xs font-medium text-[#78716C] hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newTypeSubmitting}
                  className="rounded-lg bg-[#C6A76A] px-4 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#B39356] disabled:opacity-50"
                >
                  {newTypeSubmitting ? "Creating..." : "Create Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Marks imported content that Luftansa has not yet confirmed. */
function UnverifiedBadge({ onVerify }: { onVerify: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] text-amber-900">
      <AlertCircle className="h-3 w-3 text-amber-600" />
      <span>Unverified: imported from the storefront reference design, not yet confirmed.</span>
      <button
        type="button"
        onClick={onVerify}
        className="font-semibold underline underline-offset-2 hover:text-amber-950"
        title="Mark as confirmed. Takes effect when you save."
      >
        Mark verified
      </button>
    </span>
  );
}

/** Active variant prices and stock state for the product list. */
function VariantSummary({ variants }: { variants?: ProductVariantItem[] }) {
  const visible = (variants ?? [])
    .filter((v) => v.status !== "ARCHIVED")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (visible.length === 0) {
    return <span className="text-[#A8A29E]">No variants</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((v) => (
        <span
          key={v.sk}
          className={`rounded px-1.5 py-0.5 ${v.status === "ACTIVE" ? "bg-[#F8F5EC] text-[#292D27]" : "bg-stone-100 text-stone-500 line-through"}`}
          title={`${v.status === "ACTIVE" ? "Active" : "Inactive"} · Stock: ${v.stockQuantity ?? "Not set"} · SKU: ${v.sku ?? "Not set"}`}
        >
          {v.label ?? `${v.capacity ?? v.sizeMl} ${v.unit ?? "ml"}`}: ₹{v.priceInr.toLocaleString("en-IN")}
          <span className="ml-1 font-sans text-[10px] text-[#78716C]">
            {v.stockQuantity === undefined ? "· stock not set" : `· ${v.stockQuantity} in stock`}
          </span>
        </span>
      ))}
    </div>
  );
}
