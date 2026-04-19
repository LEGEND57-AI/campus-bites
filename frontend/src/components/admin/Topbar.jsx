import { useAuth } from '../../context/AuthContext';

const Topbar = () => {
  const { user } = useAuth();
  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm">
      <h1 className="text-xl font-semibold text-gray-800">Admin Panel</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{user?.name}</span>
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
          {user?.name?.charAt(0)}
        </div>
      </div>
    </div>
  );
};

export default Topbar;