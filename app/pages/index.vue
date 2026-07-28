<template>
    <div class="bg-cover bg-center h-screen bg-blend-multiply" style="background-image:
      radial-gradient(circle,rgba(255, 255, 255, 0.09) 5%, rgba(18, 18, 20, 1) 71%),radial-gradient(circle,rgba(255, 255, 255, 0.09) 5%, rgba(18, 18, 20, 1) 71%),
      url('https://images.unsplash.com/photo-1604514288114-3851479df2f2');
    ">
        <nav class="flex bg-[#121214]/80 p-5 items-center justify-between backdrop-blur-[30px]">
            <h1 class="font-StackSansHeadline font-bold text-[1.5rem] text-white">TONO</h1>
            <div class="flex justify-between gap-10">
                <div class="text-white">Home</div>
                <div class="text-white">About</div>
                <div class="text-white">Contact</div>
            </div>
            <button class="bg-[#b4b8da] p-2 px-4 text-[#121214] font-bold rounded-full">Login</button>
        </nav>
        <div class="relative flex flex-col gap-10 items-center justify-center h-[calc(100vh-80px)]">
            <h1 class="font-StackSansHeadline text-white font-bold text-[6rem] text-center">LOCAL MUSICIANS <br> <mark
                    class="bg-[#b4b8da]/25 text-[#e5e7ff] backdrop-blur-xs">BEST FRIEND</mark></h1>
            <h1 class="font-StackSansHeadline text-white font-bold text-[6rem] text-center blur-xl opacity-30 absolute">
                LOCAL MUSICIANS <br> BEST FRIEND</h1>

            <div class="flex items-center justify-center gap-10">
                <button class="bg-[#b4b8da] p-2 px-4 text-[#121214] font-bold rounded-full">Get Started</button>
                <button
                    class="bg-[#121214]/80 p-2 px-4 text-[#b4b8da] font-bold rounded-full border border-[#b4b8da]/50">Learn
                    More</button>
            </div>
        </div>
        <div class="bg-cover bg-center h-screen" style="background: #121214;
background: linear-gradient(0deg, rgba(18, 18, 20, 1) 0%, rgba(18, 18, 20, 1) 100%);">
            <h1 class="text-white">Discover Your Next Favorite Artist</h1>
        </div>
    </div>
</template>