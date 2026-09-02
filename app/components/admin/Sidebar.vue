<script setup lang="ts">
const route = useRoute()
const { signOutAdmin } = useAdminAuth()
const navItems = [
  {
    name: 'Dashboard',
    path: '/admin/dashboard',
    icon: 'ic:outline-dashboard',
    activeIcon: 'ic:baseline-dashboard'
  },
  {
    name: 'Tags',
    path: '/admin/tags',
    icon: 'ic:outline-label',
    activeIcon: 'ic:baseline-label'
  },
  {
    name: 'Reports',
    path: '/admin/reports',
    icon: 'ic:baseline-outlined-flag',
    activeIcon: 'ic:baseline-flag'
  },
  {
    name: 'Users',
    path: '/admin/users',
    icon: 'ic:outline-supervisor-account',
    activeIcon: 'ic:baseline-supervisor-account'
  },
  {
    name: 'Verifications',
    path: '/admin/verifications',
    icon: 'ic:outline-verified-user',
    activeIcon: 'ic:baseline-verified-user'
  }
]
const handleLogout = async () => {
  await signOutAdmin()
}
</script>

<template>
  <aside
    id="logo-sidebar"
    class="fixed top-0 left-0 z-40 w-64 h-full transition-transform -translate-x-full sm:translate-x-0 bg-[#201F21]"
    aria-label="Sidebar"
  >
    <div class="h-full flex flex-col justify-between w-[256px] p-6 overflow-y-auto bg-neutral-primary-soft border-e border-[#46464D]">
      <div>
        <!-- Logo -->
        <div class="flex items-center gap-2 mb-12">
          <img src="/TONO_LOGO.svg" alt="Logo" class="h-10 w-10 rounded-full" />
          <div>
            <h1 class="text-xl font-bold">TONO</h1>
            <h2 class="text-xl font-light text-[#D0D4F7]">ADMIN PANEL</h2>
          </div>
        </div>
<ul class="space-y-2">
  <li v-for="item in navItems" :key="item.path">
    <NuxtLink
      :to="item.path"
      class="flex items-center px-2 py-1.5 rounded transition-colors"
      :class="route.path === item.path
        ? 'bg-[#B4B8DA] text-[#444865] font-bold'
        : 'text-[#C7C5CE] hover:bg-[#B4B8DA]/20 hover:text-white'"
    >
      <!-- Single dynamic Icon based on current route -->
      <Icon
        :name="route.path === item.path ? item.activeIcon : item.icon"
        class="text-2xl"
      />
      <span class="ms-3">{{ item.name }}</span>
    </NuxtLink>
  </li>
</ul>

      </div>

      <!-- Logout -->
      <div>
        <button
          @click="handleLogout"
          class="flex items-center gap-2 px-2 py-1.5 text-[#C7C5CE] hover:text-white hover:bg-neutral-tertiary w-full text-left rounded transition-colors"
        >
          <Icon name="ic:baseline-logout" class="text-2xl" />
          <span class="ms-3">Logout</span>
        </button>
      </div>
    </div>
  </aside>
</template>
