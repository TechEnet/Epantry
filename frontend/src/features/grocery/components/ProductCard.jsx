import {
  ArrowRight,
  Package,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

function formatQuantity(
  quantity,
) {
  if (
    !quantity ||
    quantity.value ===
      null ||
    quantity.value ===
      undefined
  ) {
    return null
  }

  return `${quantity.value} ${quantity.unit || ''}`.trim()
}

export default function ProductCard({
  product,
  variant,
}) {
  const imageUrl =
    product?.image?.url ||
    ''

  const quantity =
    formatQuantity(
      product?.netQuantity,
    )

  const productPath =
    `/grocery/product/${encodeURIComponent(
      product?.slug ||
        '',
    )}`

  // Grocery-only presentation. Other ProductCard consumers retain the default UI.
  if (variant === 'grocery') {
    return (
      <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#dfe5db] bg-white shadow-[0_3px_12px_rgba(25,52,35,0.035)] transition-all duration-300 hover:-translate-y-1 hover:border-[#9cbaa4] hover:shadow-[0_18px_35px_-15px_rgba(18,62,40,0.22)] focus-within:border-[#538769] motion-reduce:transform-none motion-reduce:transition-none">
        <div className="relative m-3 mb-0 overflow-hidden rounded-2xl bg-[#f7f8f3]">
          <Link
            to={productPath}
            aria-label={`View ${product?.displayName || 'grocery product'}`}
            className="focus-ring relative block h-[248px] overflow-hidden rounded-2xl sm:h-[260px] xl:h-[280px]"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product?.image?.alt || product?.displayName || 'Grocery product'}
                className="absolute inset-0 h-full w-full object-contain p-5 pt-10 transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
              />
            ) : (
              <div className="grid h-full place-items-center text-[#809c83]">
                <Package size={52} strokeWidth={1.25} aria-hidden="true" />
              </div>
            )}
          </Link>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e6d6] bg-[#edf5e9]/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#355d3e]">
              <span aria-hidden="true" className="size-1 rounded-full bg-[#50875a]" />
              Canonical
            </span>
            {quantity && (
              <span className="max-w-[48%] rounded-full border border-[#e1e4db] bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-[#5f6c5d] shadow-sm">
                {quantity}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          {product?.brand?.name && (
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#447354]">{product.brand.name}</p>
          )}
          <h3
            className="mt-2 min-h-[2.6em] line-clamp-2 text-[19px] font-bold leading-[1.3] tracking-[-0.025em] text-[#173c2d] xl:text-[21px]"
            title={product?.displayName || 'Unnamed product'}
          >
            {product?.displayName || 'Unnamed product'}
          </h3>
          <div className="mb-4 mt-2 flex min-h-5 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#73806f]">
            {product?.category?.name && <span>{product.category.name}</span>}
            {product?.pack?.type && product.pack.type !== 'other' && (
              <span className="inline-flex items-center gap-1.5 capitalize text-[#64745e]">
                <Package size={12} strokeWidth={1.6} aria-hidden="true" />
                {product.pack.type}
              </span>
            )}
          </div>
          <div className="mt-auto border-t border-[#e9ece3] pt-4">
            <Link
              to={productPath}
              aria-label={`View product: ${product?.displayName || 'Unnamed product'}`}
              className="focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#dce6d8] bg-[#eef4e9] px-4 py-2.5 text-sm font-semibold text-[#1a5238] transition-colors group-hover:border-[#175339] group-hover:bg-[#175339] group-hover:text-white focus-visible:border-[#175339] focus-visible:bg-[#175339] focus-visible:text-white"
            >
              View product
              <ArrowRight size={17} strokeWidth={1.7} className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#16A34A]/30 hover:shadow-xl hover:shadow-[#111827]/10">

      {/* =========================================================
          IMAGE FRAME
      ========================================================= */}

      <Link
        to={
          productPath
        }
        className="focus-ring relative block aspect-[4/3] overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#F8FAF7]"
      >

        {imageUrl ? (
          <img
            src={
              imageUrl
            }
            alt={
              product?.image?.alt ||
              product?.displayName ||
              'Grocery product'
            }
            className="absolute inset-0 h-full w-full object-contain p-3"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#16A34A]/35">

            <Package
              size={48}
              strokeWidth={1.5}
              aria-hidden="true"
            />

          </div>
        )}

      </Link>


      {/* =========================================================
          PRODUCT META
      ========================================================= */}

      <div className="px-2 pb-2 pt-4">

        <div className="flex items-center justify-between gap-3">

          <div className="inline-flex rounded-full bg-[#F0FDF4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#166534]">
            Canonical
          </div>

        </div>


        <h2 className="mt-3 line-clamp-2 text-xl font-black leading-tight tracking-[-0.02em] text-[#111827]">
          {
            product?.displayName ||
            'Unnamed product'
          }
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#6B7280]">

          {product?.brand?.name && (
            <span className="text-[#166534]">
              {
                product.brand
                  .name
              }
            </span>
          )}

          {product?.category?.name && (
            <>
              <span className="text-[#D1D5DB]">
                •
              </span>

              <span>
                {
                  product
                    .category
                    .name
                }
              </span>
            </>
          )}

        </div>


        <div className="mt-3 flex min-h-7 flex-wrap gap-2">

          {quantity && (
            <span className="rounded-full bg-[#F8FAF7] px-2.5 py-1 text-[11px] font-bold text-[#6B7280]">
              {quantity}
            </span>
          )}

          {product?.pack?.type &&
            product.pack.type !==
              'other' && (
              <span className="rounded-full bg-[#F0FDF4] px-2.5 py-1 text-[11px] font-bold capitalize text-[#166534]">
                {
                  product.pack
                    .type
                }
              </span>
            )}

        </div>


        <Link
          to={
            productPath
          }
          className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-black text-[#166534] transition hover:text-[#14532D]"
        >
          View product

          <ArrowRight
            size={16}
            aria-hidden="true"
          />

        </Link>

      </div>

    </article>
  )
}
