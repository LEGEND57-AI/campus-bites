import FoodCard from "../FoodCard";

const FavoritesGrid = ({ items, onAddToCart }) => {
    return (
        <div className="w-full">

            {/* LEFT SIDE */}
            <div className="flex-1">

                <div className="mb-6">

                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            Favorite Items
                        </h2>

                        <p className="text-gray-500 mt-1">
                            {items.length} Items
                        </p>
                    </div>



                </div>

                {items.length === 0 ? (

                    <div className="bg-slate-50 rounded-3xl py-20 text-center">

                        <div className="text-6xl mb-4">❤️</div>

                        <h3 className="text-xl font-bold">
                            No favorites yet
                        </h3>

                        <p className="text-gray-500 mt-2">
                            Start adding your favorite meals.
                        </p>

                    </div>

                ) : (

                    <div
                        className="
    grid
    grid-cols-1
    sm:grid-cols-2
    lg:grid-cols-2
    xl:grid-cols-3
    2xl:grid-cols-4
    gap-6
  "
                    >

                        {items.map((item) => (
                            <FoodCard
                                key={item.id}
                                item={item}
                                onAddToCart={onAddToCart}
                            />
                        ))}

                    </div>

                )}

            </div>



        </div>
    );
};

export default FavoritesGrid;