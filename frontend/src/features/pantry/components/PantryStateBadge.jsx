import {
  CircleCheck,
  CircleHelp,
  EyeOff,
  PackageCheck,
  PackageX,
  ShoppingBag,
  TriangleAlert,
} from 'lucide-react'

const STATE_PRESENTATION =
  Object.freeze({
    confirmed_available: {
      label:
        'Confirmed',

      description:
        'Recently confirmed by a reliable household signal.',

      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800',

      Icon:
        CircleCheck,
    },

    inferred_available: {
      label:
        'Likely in pantry',

      description:
        'Estimated from previous signals. Please confirm if needed.',

      className:
        'border-sky-200 bg-sky-50 text-sky-800',

      Icon:
        CircleHelp,
    },

    running_low: {
      label:
        'Running low',

      description:
        'The Pantry signal suggests this may be running low.',

      className:
        'border-amber-200 bg-amber-50 text-amber-800',

      Icon:
        TriangleAlert,
    },

    uncertain: {
      label:
        'Needs confirmation',

      description:
        'Current availability cannot be confirmed confidently.',

      className:
        'border-stone-300 bg-stone-100 text-stone-700',

      Icon:
        CircleHelp,
    },

    out: {
      label:
        'Out',

      description:
        'The latest household signal says this is finished or unavailable.',

      className:
        'border-rose-200 bg-rose-50 text-rose-800',

      Icon:
        PackageX,
    },

    replenished_elsewhere: {
      label:
        'Bought elsewhere',

      description:
        'A household member reported replenishing this elsewhere.',

      className:
        'border-violet-200 bg-violet-50 text-violet-800',

      Icon:
        ShoppingBag,
    },

    do_not_track: {
      label:
        'Not tracking',

      description:
        'This item is intentionally excluded from Pantry tracking.',

      className:
        'border-stone-300 bg-white text-stone-600',

      Icon:
        EyeOff,
    },
  })

const FALLBACK_STATE = {
  label:
    'Needs confirmation',

  description:
    'Current Pantry state is uncertain.',

  className:
    'border-stone-300 bg-stone-100 text-stone-700',

  Icon:
    PackageCheck,
}

export function getPantryStatePresentation(
  state,
) {
  return (
    STATE_PRESENTATION[
      state
    ] ||
    FALLBACK_STATE
  )
}

export default function PantryStateBadge({
  state,
  showDescription =
    false,
}) {
  const presentation =
    getPantryStatePresentation(
      state,
    )

  const {
    label,
    description,
    className,
    Icon,
  } =
    presentation

  return (
    <div>
      <span
        className={[
          'inline-flex',
          'items-center',
          'gap-1.5',
          'rounded-full',
          'border',
          'px-2.5',
          'py-1',
          'text-xs',
          'font-black',
          className,
        ].join(
          ' ',
        )}
      >
        <Icon
          size={14}
          aria-hidden="true"
        />

        {label}
      </span>

      {showDescription && (
        <p className="mt-2 text-xs leading-5 text-stone-500">
          {description}
        </p>
      )}
    </div>
  )
}