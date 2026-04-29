<script setup lang="ts">
import { computed, ref } from 'vue'
import type { IDataTableColumn, IEconomyPaginatedResponse } from '~/types/economy'

interface Props<T extends Record<string, any> = Record<string, any>> {
  columns: IDataTableColumn<T>[]
  data: T[]
  loading?: boolean
  pagination?: IEconomyPaginatedResponse<T> | null
  emptyText?: string
  stripe?: boolean
  border?: boolean
  size?: '' | 'large' | 'default' | 'small'
  rowKey?: string
  selectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  pagination: null,
  emptyText: 'No data',
  stripe: true,
  border: false,
  size: 'default',
  rowKey: 'id',
  selectable: false,
})

const emit = defineEmits<{
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
  (e: 'sortChange', column: unknown, prop: string, order: string): void
  (e: 'rowClick', row: unknown): void
  (e: 'selectionChange', rows: unknown[]): void
}>()

const currentPage = ref(props.pagination?.page || 1)
const currentSize = ref(props.pagination?.pageSize || 10)

const pageSizes = [10, 20, 50, 100]

const handlePageChange = (page: number) => {
  currentPage.value = page
  emit('pageChange', page)
}

const handleSizeChange = (size: number) => {
  currentSize.value = size
  emit('pageSizeChange', size)
}

const handleSortChange = (e: { column: unknown; prop: string; order: string }) => {
  emit('sortChange', e.column, e.prop, e.order)
}

const elTableColumns = computed(() =>
  props.columns.map(col => ({
    prop: col.prop as string,
    label: col.label,
    width: col.width,
    minWidth: col.minWidth,
    sortable: col.sortable,
    align: col.align || 'left',
    fixed: col.fixed,
    formatter: col.formatter,
    slot: col.slot,
  }))
)
</script>

<template>
  <div class="data-table-wrapper">
    <ElTable
      v-loading="loading"
      :data="data"
      :stripe="stripe"
      :border="border"
      :size="size"
      :row-key="rowKey"
      highlight-current-row
      class="data-table"
      @sort-change="handleSortChange"
      @row-click="emit('rowClick', $event)"
    >
      <ElTableColumn v-if="selectable" type="selection" width="48" />

      <ElTableColumn
        v-for="col in elTableColumns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        :sortable="col.sortable"
        :align="col.align"
        :fixed="col.fixed"
        show-overflow-tooltip
      >
        <template v-if="col.formatter" #default="{ row, column, $index }">
          <span v-html="col.formatter(row, col, row[col.prop], $index)" />
        </template>
        <template v-else-if="col.slot" #default="{ row }">
          <slot :name="col.slot" :row="row" />
        </template>
      </ElTableColumn>

      <template #empty>
        <ElEmpty :description="emptyText" />
      </template>
    </ElTable>

    <div v-if="pagination" class="pagination-wrapper">
      <ElPagination
        v-model:current-page="currentPage"
        v-model:page-size="currentSize"
        :total="pagination.total"
        :page-sizes="pageSizes"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.data-table-wrapper {
  border-radius: 12px;
  overflow: hidden;
}
.data-table {
  width: 100%;
}
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 16px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
}
.dark .pagination-wrapper {
  background: #1e293b;
  border-color: #334155;
}
</style>

