import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import toast from "react-hot-toast";

import { useCart } from "../context/CartContext";
import { foodAPI, categoryAPI } from "../services/api";
import { getSocket } from "../socket/socket";
import { SocketEvents } from "../socket/constants";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";

import FoodCard from "../components/FoodCard";
import CategoryFilter from "../components/CategoryFilter";
import LoadingSkeleton from "../components/LoadingSkeleton";


const PAGE_SIZE = 12;


const Menu = () => {

  const [searchParams] = useSearchParams();

  const { addToCart } = useCart();


  // ================= DATA =================

  const [foodItems, setFoodItems] = useState([]);

  const [categories, setCategories] = useState([]);

  const [selectedCategory, setSelectedCategory] =
    useState("all");

  const [searchQuery, setSearchQuery] =
    useState(
      searchParams.get("search") || ""
    );


  // ================= PAGINATION =================

  const [page, setPage] = useState(1);

  const [hasMore, setHasMore] =
    useState(true);

  const [totalItems, setTotalItems] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);


  // ================= REFS =================

  const requestIdRef = useRef(0);

  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);


  // ================= SEARCH PARAM =================

  useEffect(() => {

    const search =
      searchParams.get("search") || "";

    setSearchQuery(search);

  }, [searchParams]);


  // ================= FETCH CATEGORIES =================

  const fetchCategories = useCallback(async () => {

    try {

      const { data } =
        await categoryAPI.getAll();

      setCategories(data || []);

    } catch (error) {

      console.error(error);

    }

  }, []);


  // ================= FETCH FOOD ITEMS =================

  const fetchFoodItems = useCallback(
    async (pageNumber = 1, append = false) => {

      const requestId =
        ++requestIdRef.current;

      try {

        if (append) {

          setLoadingMore(true);

        } else {

          setLoading(true);

        }


        const params = {

          page: pageNumber,

          limit: PAGE_SIZE,

        };


        if (
          selectedCategory !== "all"
        ) {

          params.categoryId =
            selectedCategory;

        }


        if (searchQuery.trim()) {

          params.search =
            searchQuery.trim();

        }


        const { data } =
          await foodAPI.getItems(params);


        // Ignore outdated request
        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }


        const newItems =
          data?.items || [];

        setHasLoadedOnce(true);


        if (append) {

          setFoodItems(
            (previousItems) => {

              const existingIds =
                new Set(
                  previousItems.map(
                    (item) =>
                      item.id
                  )
                );


              const uniqueNewItems =
                newItems.filter(
                  (item) =>
                    !existingIds.has(
                      item.id
                    )
                );


              return [
                ...previousItems,
                ...uniqueNewItems,
              ];

            }
          );

        } else {

          setFoodItems(
            newItems
          );

        }


        const currentPage =
          data?.page || pageNumber;

        pageRef.current = currentPage;

        setPage(currentPage);

        setHasMore(
          Boolean(data?.hasMore)
        );


        setTotalItems(
          data?.total || 0
        );


      } catch (error) {

        console.error(
          "Failed to load food items:",
          error
        );

        if (!append) {

          toast.error(
            "Failed to load menu"
          );

        }

      } finally {

        if (append) {

          loadingMoreRef.current = false;

          setLoadingMore(false);

        } else {

          setLoading(false);

        }

      }

    },
    [
      selectedCategory,
      searchQuery,
    ]
  );


  // ================= INITIAL / FILTER LOAD =================

  useEffect(() => {

    fetchCategories();

  }, [fetchCategories]);


  useEffect(() => {

    // Reset pagination
    setFoodItems([]);

    setHasLoadedOnce(false);

    pageRef.current = 1;

    setPage(1);

    setHasMore(true);

    setTotalItems(0);

    // Load first page
    fetchFoodItems(1, false);

  }, [
    selectedCategory,
    searchQuery,
    fetchFoodItems,
  ]);


  // ================= LOAD MORE =================

  const loadMore = useCallback(() => {

    if (
      loading ||
      loadingMoreRef.current ||
      !hasMore
    ) {
      return;
    }

    const nextPage =
      pageRef.current + 1;

    loadingMoreRef.current = true;

    setLoadingMore(true);

    fetchFoodItems(
      nextPage,
      true
    );

  }, [
    loading,
    hasMore,
    fetchFoodItems,
  ]);


  // ================= INFINITE SCROLL =================

  useEffect(() => {

    const handleScroll = () => {

      if (
        loading ||
        loadingMoreRef.current ||
        !hasMore
      ) {
        return;
      }

      const scrollPosition =
        window.innerHeight +
        window.scrollY;

      const documentHeight =
        document.documentElement.scrollHeight;

      // Start loading before reaching the bottom
      if (
        scrollPosition >=
        documentHeight - 600
      ) {
        loadMore();
      }

    };

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    // Check once after initial render
    handleScroll();

    return () => {

      window.removeEventListener(
        "scroll",
        handleScroll
      );

    };

  }, [
    loading,
    hasMore,
    loadMore,
  ]);


  // ================= SOCKET MENU UPDATE =================

  useEffect(() => {

    const socket = getSocket();

    if (!socket) return;


    const handleMenuUpdate = () => {

      fetchCategories();

      // Refresh from page 1
      setFoodItems([]);

      setHasLoadedOnce(false);

      pageRef.current = 1;

      setPage(1);

      setHasMore(true);

      setTotalItems(0);

      fetchFoodItems(
        1,
        false
      );

    };


    socket.on(
      SocketEvents.MENU_UPDATED,
      handleMenuUpdate
    );


    return () => {

      socket.off(
        SocketEvents.MENU_UPDATED,
        handleMenuUpdate
      );

    };

  }, [
    fetchCategories,
    fetchFoodItems,
  ]);


  // ================= UI =================

  return (

    <div
      className="
                bg-white
                flex
                min-h-screen

                rounded-none
                shadow-none
                overflow-visible

                md:rounded-[32px]
                md:overflow-hidden
                md:min-h-[calc(100vh-24px)]
                md:shadow-[0_15px_40px_rgba(0,0,0,0.08)]
            "
    >

      {/* Sidebar Desktop */}

      <Sidebar />


      {/* Right Content */}

      <div className="flex-1 min-w-0">

        {/* Header */}

        <DashboardHeader />


        {/* Main Area */}

        <main
          className="
                        px-3
                        sm:px-4
                        md:px-6
                        lg:px-8
                        py-4
                        md:py-5
                        pb-24
                        max-w-full
                        md:max-w-none
                        overflow-x-hidden
                    "
        >

          {/* PAGE TITLE */}

          <div className="mb-7 md:mb-8">

            <h1
              className="
                                text-3xl
                                md:text-4xl
                                font-bold
                                text-slate-900
                            "
            >
              Menu
            </h1>


            <p
              className="
                                text-gray-500
                                mt-2
                                text-sm
                                md:text-base
                            "
            >
              Discover delicious meals
              and snacks on campus.
            </p>

          </div>


          {/* SEARCH BAR */}

          <div className="mb-7 md:mb-8">

            <div className="relative">

              <Search
                size={20}
                className="
                                    absolute
                                    left-4
                                    top-1/2
                                    -translate-y-1/2
                                    text-gray-400
                                "
              />


              <input
                type="text"
                placeholder="Search food, drinks, snacks..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                className="
                                    w-full
                                    h-12
                                    lg:h-14
                                    pl-12
                                    pr-4
                                    rounded-2xl
                                    border
                                    border-gray-200
                                    bg-white
                                    outline-none
                                    focus:border-blue-500
                                    focus:ring-4
                                    focus:ring-blue-100
                                "
              />

            </div>

          </div>


          {/* CATEGORY FILTER */}

          <div className="mb-7 md:mb-8">

            <CategoryFilter
              categories={categories}
              selectedCategory={
                selectedCategory
              }
              onSelectCategory={
                setSelectedCategory
              }
            />

          </div>


          {/* ALL ITEMS HEADER */}

          <div
            className="
                            flex
                            items-center
                            justify-between
                            mb-5
                            md:mb-6
                        "
          >

            <h2
              className="
                                text-xl
                                md:text-2xl
                                font-bold
                                text-slate-900
                            "
            >
              All Items
            </h2>


            <span
              className="
                                text-sm
                                text-gray-500
                            "
            >
              {totalItems} Items
            </span>

          </div>


          {/* INITIAL LOADING */}

          {loading || (foodItems.length === 0 && !hasLoadedOnce) ? (

            <LoadingSkeleton />

          ) : foodItems.length === 0 ? (

            <div className="
        bg-white
        rounded-3xl
        py-20
        text-center
        text-gray-400
    ">
              No food items found 😔
            </div>

          ) : (

            <>

              {/* FOOD GRID */}

              <div
                className="
                                    grid
                                    grid-cols-1
                                    sm:grid-cols-2
                                    xl:grid-cols-4
                                    gap-4
                                    sm:gap-6
                                "
              >

                {foodItems.map(
                  (
                    item,
                    index
                  ) => (

                    <motion.div
                      key={item.id}
                      initial={{
                        opacity: 0,
                        y: 20,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay:
                          index *
                          0.03,
                      }}
                    >

                      <FoodCard
                        item={item}
                        onAddToCart={
                          addToCart
                        }
                      />

                    </motion.div>

                  )
                )}

              </div>


              {/* LOAD MORE AREA */}

              {hasMore && (

                <div className="w-full py-8">

                  {loadingMore && (

                    <div
                      className="
                                                grid
                                                grid-cols-1
                                                sm:grid-cols-2
                                                xl:grid-cols-4
                                                gap-4
                                                sm:gap-6
                                            "
                    >

                      {[1, 2, 3, 4].map(
                        (
                          item
                        ) => (

                          <div
                            key={
                              item
                            }
                            className="
                                                            bg-white
                                                            rounded-3xl
                                                            border
                                                            border-slate-100
                                                            overflow-hidden
                                                            shadow-sm
                                                            animate-pulse
                                                        "
                          >

                            <div
                              className="
                                                                h-48
                                                                bg-slate-200
                                                            "
                            />

                            <div
                              className="
                                                                p-5
                                                            "
                            >

                              <div
                                className="
                                                                    h-5
                                                                    w-2/3
                                                                    bg-slate-200
                                                                    rounded
                                                                    mb-3
                                                                "
                              />

                              <div
                                className="
                                                                    h-4
                                                                    w-full
                                                                    bg-slate-200
                                                                    rounded
                                                                    mb-2
                                                                "
                              />

                              <div
                                className="
                                                                    h-4
                                                                    w-3/4
                                                                    bg-slate-200
                                                                    rounded
                                                                    mb-5
                                                                "
                              />

                              <div
                                className="
                                                                    h-10
                                                                    w-full
                                                                    bg-slate-200
                                                                    rounded-2xl
                                                                "
                              />

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  )}

                </div>

              )}


            </>

          )}

        </main>


        {/* Mobile Bottom Navigation */}

        <MobileBottomNav />

      </div>

    </div>

  );

};

export default Menu;