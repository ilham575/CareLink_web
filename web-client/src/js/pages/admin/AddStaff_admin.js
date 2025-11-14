import React, { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import FormStaffPage from '../../components/middle_page/formStaffPage';

function AddStaffAdmin() {
  const { pharmacyId } = useParams();
  const location = useLocation();

  return (
    <FormStaffPage />
  );
}

export default AddStaffAdmin;