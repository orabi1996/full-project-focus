CREATE TYPE public.app_role AS ENUM ('org_admin','hr_manager','line_manager','employee');
CREATE TYPE public.employee_status AS ENUM ('active','on_leave','suspended','terminated');
CREATE TYPE public.attendance_status AS ENUM ('present','late','absent','leave','remote');
CREATE TYPE public.request_type AS ENUM ('leave','attendance_fix','advance','expense');
CREATE TYPE public.request_status AS ENUM ('draft','pending','approved','rejected','returned');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('org_admin','hr_manager'))
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr_manager') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept_read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept_write" ON public.departments FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text NOT NULL UNIQUE,
  full_name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_title text NOT NULL DEFAULT '',
  email text,
  phone text,
  hire_date date NOT NULL DEFAULT current_date,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  status public.employee_status NOT NULL DEFAULT 'active',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp_read" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "emp_write" ON public.employees FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  check_in time,
  check_out time,
  status public.attendance_status NOT NULL DEFAULT 'present',
  worked_hours numeric(5,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_read" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "att_write" ON public.attendance_records FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('REQ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type public.request_type NOT NULL,
  status public.request_status NOT NULL DEFAULT 'pending',
  start_date date,
  end_date date,
  days integer,
  amount numeric(12,2),
  reason text,
  decision_note text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_read" ON public.requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "req_insert" ON public.requests FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "req_update" ON public.requests FOR UPDATE TO authenticated USING (public.is_hr(auth.uid()) OR created_by = auth.uid()) WITH CHECK (public.is_hr(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "req_delete" ON public.requests FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

INSERT INTO public.departments (id, name, code) VALUES
 ('11111111-1111-4111-8111-111111111101','التقنية','TECH'),
 ('11111111-1111-4111-8111-111111111102','المالية','FIN'),
 ('11111111-1111-4111-8111-111111111103','الموارد البشرية','HR'),
 ('11111111-1111-4111-8111-111111111104','العمليات','OPS'),
 ('11111111-1111-4111-8111-111111111105','المبيعات','SLS');

INSERT INTO public.employees (id, employee_no, full_name, department_id, job_title, email, phone, hire_date, basic_salary, status) VALUES
 ('22222222-2222-4222-8222-222222222201','EMP-0142','خالد المهيري','11111111-1111-4111-8111-111111111101','مهندس برمجيات أول','khalid@example.com','0551000142','2021-03-01',18500,'active'),
 ('22222222-2222-4222-8222-222222222202','EMP-0198','نورة القحطاني','11111111-1111-4111-8111-111111111102','محاسبة أولى','noura@example.com','0551000198','2020-09-15',22000,'on_leave'),
 ('22222222-2222-4222-8222-222222222203','EMP-0203','فيصل الزهراني','11111111-1111-4111-8111-111111111104','مشرف عمليات','faisal@example.com','0551000203','2022-01-10',15800,'active'),
 ('22222222-2222-4222-8222-222222222204','EMP-0117','سارة العتيبي','11111111-1111-4111-8111-111111111103','أخصائية موارد بشرية','sara@example.com','0551000117','2019-06-20',19200,'active'),
 ('22222222-2222-4222-8222-222222222205','EMP-0221','محمد الشمري','11111111-1111-4111-8111-111111111101','مطور واجهات','mohammed@example.com','0551000221','2023-02-05',14300,'suspended'),
 ('22222222-2222-4222-8222-222222222206','EMP-0233','عبدالله الحربي','11111111-1111-4111-8111-111111111105','مدير مبيعات','abdullah@example.com','0551000233','2018-11-01',26500,'active'),
 ('22222222-2222-4222-8222-222222222207','EMP-0245','ريم الدوسري','11111111-1111-4111-8111-111111111101','مهندسة بيانات','reem@example.com','0551000245','2022-08-14',20100,'active'),
 ('22222222-2222-4222-8222-222222222208','EMP-0250','مشعل الغامدي','11111111-1111-4111-8111-111111111104','منسق مشاريع','mishal@example.com','0551000250','2024-01-02',12700,'active');

INSERT INTO public.attendance_records (employee_id, work_date, check_in, check_out, status, worked_hours) VALUES
 ('22222222-2222-4222-8222-222222222201', current_date, '08:02','17:05','present',9.05),
 ('22222222-2222-4222-8222-222222222203', current_date, '08:41','17:00','late',8.32),
 ('22222222-2222-4222-8222-222222222204', current_date, '07:55','16:58','present',9.05),
 ('22222222-2222-4222-8222-222222222206', current_date, '09:10','18:00','late',8.83),
 ('22222222-2222-4222-8222-222222222207', current_date, '08:00','17:00','remote',9.00),
 ('22222222-2222-4222-8222-222222222202', current_date, NULL, NULL,'leave',0),
 ('22222222-2222-4222-8222-222222222208', current_date, NULL, NULL,'absent',0),
 ('22222222-2222-4222-8222-222222222201', current_date - 1, '08:00','17:00','present',9.00),
 ('22222222-2222-4222-8222-222222222203', current_date - 1, '08:05','17:10','present',9.08),
 ('22222222-2222-4222-8222-222222222208', current_date - 1, '08:30','16:00','late',7.50);

INSERT INTO public.requests (reference, employee_id, type, status, start_date, end_date, days, amount, reason) VALUES
 ('REQ-100001','22222222-2222-4222-8222-222222222206','leave','pending', current_date + 3, current_date + 7, 5, NULL,'إجازة سنوية'),
 ('REQ-100002','22222222-2222-4222-8222-222222222207','expense','pending', current_date - 2, current_date - 2, NULL, 3240,'مصاريف سفر عمل'),
 ('REQ-100003','22222222-2222-4222-8222-222222222208','advance','pending', NULL, NULL, NULL, 5000,'سلفة شخصية'),
 ('REQ-100004','22222222-2222-4222-8222-222222222201','attendance_fix','approved', current_date - 5, current_date - 5, 1, NULL,'نسيان تسجيل الخروج'),
 ('REQ-100005','22222222-2222-4222-8222-222222222204','leave','rejected', current_date - 10, current_date - 8, 3, NULL,'ظرف عائلي');