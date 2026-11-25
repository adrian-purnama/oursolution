import { Button } from '#/components/ui/button'
import { hintClassName } from '#/lib/ui-classes'
import { m } from '#/paraglide/messages'

type Props = {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

export default function ListPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: Props) {
  if (totalItems === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between gap-3">
      <p className={`hidden text-sm sm:block ${hintClassName}`}>
        {m.pagination_showing({ from, to, total: totalItems })}
      </p>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {m.pagination_prev()}
        </Button>
        <span className={`text-sm ${hintClassName}`}>
          {m.pagination_page({ page, total: totalPages })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {m.pagination_next()}
        </Button>
      </div>
    </div>
  )
}
