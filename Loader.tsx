import React from 'react';

interface LoaderProps {
  message?: string;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Đang xử lý...' }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center z-50">
      <div className="w-16 h-16 border-4 border-slate-400 border-t-amber-400 rounded-full animate-spin"></div>
      <p className="mt-4 text-lg text-amber-400 font-semibold">{message}</p>
    </div>
  );
};

export default Loader;
