import codecs

# 读取 index.vue
with codecs.open('apps/landing/pages/index.vue', 'r', 'utf-8') as f:
    content = f.read()
lines = content.split('\n')

# 找到 dashboard section 的范围
dash_start = None
dash_end = None
for i, line in enumerate(lines):
    if 'Authenticated Dashboard Extension' in line:
        dash_start = i
    if dash_start is not None and '</section>' in line and i > dash_start:
        dash_end = i
        break

# 提取 dashboard template (去除 v-if)
dashboard_template_lines = lines[dash_start:dash_end+1]
dashboard_template = '\n'.join(dashboard_template_lines)
dashboard_template = dashboard_template.replace('v-if="authStore.isAuthenticated" ', '')

# 提取 script 部分
script_start = None
script_end = None
for i, line in enumerate(lines):
    if '<script setup' in line:
        script_start = i
    if script_start is not None and '</script>' in line and i > script_start:
        script_end = i
        break

# 提取 style 部分
style_start = None
for i, line in enumerate(lines):
    if '<style' in line:
        style_start = i
        break

style_lines = lines[style_start:]

# 构建 dashboard.vue
dashboard_content = '''<template>
  <div class="dashboard-page" style="background: var(--ah-bg-page);">
    <div class="dashboard-header">
      <h1>我的工作台</h1>
      <p class="dashboard-subtitle">选择项目继续，或创建新项目</p>
    </div>
''' + dashboard_template + '''
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FolderOpened, Plus, ShoppingBag } from '@element-plus/icons-vue'
import { useAuthStore } from '~/stores/auth'
import { useProjectStore, type Project } from '~/stores/project'

const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()

const showProjectDialog = ref(false)
const showCreateProjectDialog = ref(false)
const newProject = ref({ name: '', description: '' })
const creating = ref(false)
const projectSearchQuery = ref('')

const projects = computed(() => projectStore.projects)
const currentProject = computed(() => projectStore.currentProject)
const recentProjects = computed(() => {
  return projectStore.activeProjects.slice(0, 6)
})

const filteredProjects = computed(() => {
  if (!projectSearchQuery.value) return projects.value
  const query = projectSearchQuery.value.toLowerCase()
  return projects.value.filter((p: Project) =>
    p.name.toLowerCase().includes(query) ||
    (p.description || '').toLowerCase().includes(query)
  )
})

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await projectStore.fetchProjects()
  }
})

const selectProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  showProjectDialog.value = false
  router.push(`/workspace/${project.id}`)
}

const openCreateDialog = () => {
  showProjectDialog.value = false
  showCreateProjectDialog.value = true
}

const confirmCreateProject = async () => {
  if (!newProject.value.name.trim()) return
  creating.value = true
  try {
    const project = await projectStore.createProject({
      name: newProject.value.name.trim(),
      description: newProject.value.description.trim(),
    })
    showCreateProjectDialog.value = false
    newProject.value = { name: '', description: '' }
    projectStore.setCurrentProject(project)
    ElMessage.success('项目创建成功')
    router.push(`/workspace/${project.id}`)
  } catch (err: any) {
    ElMessage.error(err.message || '创建项目失败')
  } finally {
    creating.value = false
  }
}
</script>

''' + '\n'.join(style_lines)

# 保存 dashboard.vue
with codecs.open('apps/landing/pages/dashboard.vue', 'w', 'utf-8') as f:
    f.write(dashboard_content)

print('dashboard.vue created')

# 修改 index.vue: 移除 dashboard section
new_lines = lines[:dash_start] + lines[dash_end+1:]

# 在 onMounted 中添加重定向到 /dashboard
inserted = False
for i, line in enumerate(new_lines):
    if 'onMounted' in line and 'async' in line:
        for j in range(i+1, len(new_lines)):
            if 'await projectStore.fetchProjects()' in new_lines[j]:
                indent = '    '
                new_lines.insert(j+1, f"{indent}if (authStore.isAuthenticated) {{")
                new_lines.insert(j+2, f"{indent}  router.replace('/dashboard')")
                new_lines.insert(j+3, f"{indent}  return")
                new_lines.insert(j+4, f"{indent}}}")
                inserted = True
                break
        break

if not inserted:
    # fallback: insert at end of onMounted or after script start
    for i, line in enumerate(new_lines):
        if '<script setup' in line:
            new_lines.insert(i+2, "onMounted(async () => {")
            new_lines.insert(i+3, "  if (authStore.isAuthenticated) {")
            new_lines.insert(i+4, "    router.replace('/dashboard')")
            new_lines.insert(i+5, "  }")
            new_lines.insert(i+6, "})")
            break

# 保存修改后的 index.vue
with codecs.open('apps/landing/pages/index.vue', 'w', 'utf-8') as f:
    f.write('\n'.join(new_lines))

print('index.vue updated')
