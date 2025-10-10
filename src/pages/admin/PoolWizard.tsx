import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import Step1PoolInfo from '@/components/pool-admin/Step1PoolInfo';
import Step2CanvasEditor from '@/components/pool-admin/Step2CanvasEditor';
import Step3Features from '@/components/pool-admin/Step3Features';
import Step4GenerateCoping from '@/components/pool-admin/Step4GenerateCoping';
import Step5Review from '@/components/pool-admin/Step5Review';
import { toast } from 'sonner';

export default function PoolWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [currentStep, setCurrentStep] = useState(1);
  const [poolData, setPoolData] = useState({
    pool_name: '',
    variant_name: '',
    length: 6000,
    width: 3000,
    outline_points: [],
    shallow_end: null,
    deep_end: null,
    features: [],
    has_coping: false,
    coping_type: null,
    coping_width: 400,
    grout_width: 5,
    coping_layout: null,
    notes: '',
    generatedVariants: []
  });

  // Load existing pool if editing
  const { data: existingPool, error: loadError } = useQuery({
    queryKey: ['pool-variant', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('pool_variants')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        console.error('Error loading pool for edit:', error);
        throw error;
      }
      return data;
    },
    enabled: isEdit
  });

  useEffect(() => {
    if (existingPool) {
      setPoolData({
        pool_name: existingPool.pool_name,
        variant_name: existingPool.variant_name,
        length: existingPool.length,
        width: existingPool.width,
        outline_points: existingPool.outline_points as any[] || [],
        shallow_end: existingPool.shallow_end as any,
        deep_end: existingPool.deep_end as any,
        features: existingPool.features as any[] || [],
        has_coping: existingPool.has_coping,
        coping_type: existingPool.coping_type,
        coping_width: existingPool.coping_width,
        grout_width: existingPool.grout_width,
        coping_layout: existingPool.coping_layout as any,
        notes: existingPool.notes || '',
        generatedVariants: []
      });
    }
  }, [existingPool]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (poolData.pool_name && poolData.outline_points.length > 0) {
        saveDraft();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [poolData]);

  const saveDraft = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      const poolVariant = {
        pool_name: poolData.pool_name,
        variant_name: poolData.variant_name,
        length: poolData.length,
        width: poolData.width,
        outline_points: poolData.outline_points,
        shallow_end: poolData.shallow_end,
        deep_end: poolData.deep_end,
        features: poolData.features,
        has_coping: poolData.has_coping,
        coping_type: poolData.coping_type,
        coping_width: poolData.coping_width,
        grout_width: poolData.grout_width,
        coping_layout: poolData.coping_layout,
        notes: poolData.notes,
        status: 'draft',
        created_by: user?.id,
        updated_at: new Date().toISOString()
      };

      if (id) {
        await supabase
          .from('pool_variants')
          .update(poolVariant)
          .eq('id', id);
        toast.success('Draft saved');
      } else {
        const { data } = await supabase
          .from('pool_variants')
          .insert(poolVariant)
          .select()
          .single();
        
        if (data) {
          navigate(`/admin/pool-library/${data.id}/edit`, { replace: true });
          toast.success('Draft created');
        }
      }
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save draft');
    }
  };

  const steps = [
    { num: 1, title: 'Pool Information', component: Step1PoolInfo },
    { num: 2, title: 'Pool Shape', component: Step2CanvasEditor },
    { num: 3, title: 'Features', component: Step3Features },
    { num: 4, title: 'Generate Coping', component: Step4GenerateCoping },
    { num: 5, title: 'Review & Publish', component: Step5Review },
  ];

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="min-h-screen bg-background">
      {/* Progress Stepper */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {steps.map((step, idx) => (
              <div key={step.num} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                  ${currentStep === step.num ? 'bg-primary text-primary-foreground' : 
                    currentStep > step.num ? 'bg-green-500 text-white' : 
                    'bg-muted text-muted-foreground'}
                `}>
                  {currentStep > step.num ? '✓' : step.num}
                </div>
                <div className="ml-2 hidden md:block">
                  <div className="text-xs font-medium">{step.title}</div>
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-8 md:w-16 h-1 mx-2 bg-muted">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: currentStep > step.num ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-7xl mx-auto p-6">
        <CurrentStepComponent
          poolData={poolData}
          setPoolData={setPoolData}
          onNext={() => setCurrentStep(Math.min(currentStep + 1, 5))}
          onBack={() => setCurrentStep(Math.max(currentStep - 1, 1))}
          onSaveDraft={saveDraft}
          onCancel={() => navigate('/admin/pool-library')}
        />
      </div>
    </div>
  );
}
